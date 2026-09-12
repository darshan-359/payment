// routes.js
// API routes for QuorumGuard. All inputs are validated and sanitized.
// All SQL queries use parameterized statements (no string concatenation).

const express = require('express');
const rateLimit = require('express-rate-limit');
const { getDb } = require('./database');
const { screenTransaction, makeDecision } = require('./services/fraudService');
const {
  isPartitioned,
  getActiveRegion,
  setActiveRegion,
  simulatePartition,
  restoreNetwork,
  addToOutbox,
  getOutbox,
} = require('./services/partitionService');

const router = express.Router();

// --- Rate Limiting ---
// Prevents abuse of the authorize endpoint (demo protection).
const authorizeLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Input validation helpers ---

// Reject anything that looks like a real PAN (16 continuous digits)
const REAL_PAN_REGEX = /\b\d{13,19}\b/;
// Transaction ID must be alphanumeric with hyphens
const TRANSACTION_ID_REGEX = /^[A-Za-z0-9\-]{1,50}$/;

function validateAuthorizeInput(body) {
  const errors = [];

  if (!body.transaction_id || !TRANSACTION_ID_REGEX.test(body.transaction_id)) {
    errors.push('transaction_id: must be 1-50 alphanumeric characters or hyphens');
  }
  if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0 || !isFinite(body.amount)) {
    errors.push('amount: must be a positive number');
  }
  if (!body.merchant || typeof body.merchant !== 'string' || body.merchant.trim().length === 0) {
    errors.push('merchant: required string');
  }
  if (!body.card_token || typeof body.card_token !== 'string') {
    errors.push('card_token: required string');
  } else if (REAL_PAN_REGEX.test(body.card_token.replace(/\s/g, ''))) {
    errors.push('card_token: real card numbers are not accepted — use masked tokens only');
  }
  if (!body.device_id || typeof body.device_id !== 'string' || body.device_id.trim().length === 0) {
    errors.push('device_id: required string');
  }
  if (!body.location || typeof body.location !== 'string' || body.location.trim().length === 0) {
    errors.push('location: required string');
  }
  if (!body.transaction_type || typeof body.transaction_type !== 'string') {
    errors.push('transaction_type: required string');
  }

  return errors;
}

// ============================================================
// POST /api/authorize
// The core endpoint: validate → fraud screen → authorize
// ============================================================
router.post('/authorize', authorizeLimiter, (req, res) => {
  const errors = validateAuthorizeInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const {
    transaction_id,
    amount,
    merchant,
    card_token,
    device_id,
    location,
    transaction_type,
  } = req.body;

  const db = getDb();

  // --- Idempotency check (DB-enforced unique constraint) ---
  const existing = db.prepare(
    'SELECT * FROM transactions WHERE transaction_id = ?'
  ).get(transaction_id);

  if (existing) {
    return res.status(200).json({
      duplicate: true,
      message: 'Duplicate request — returning previous authorization result.',
      transaction: existing,
    });
  }

  // --- Fraud Screening (always runs before authorization) ---
  const partitioned = isPartitioned();
  const region = getActiveRegion();
  const mode = partitioned ? 'DEGRADED' : 'NORMAL';

  const riskResult = screenTransaction({ amount, merchant, card_token, device_id, location });

  // Load current policy
  const policy = db.prepare('SELECT * FROM policies ORDER BY version DESC LIMIT 1').get();

  const { decision, reason } = makeDecision(riskResult, { amount }, policy, partitioned);

  // --- Persist the transaction (parameterized) ---
  const stmt = db.prepare(`
    INSERT INTO transactions
      (transaction_id, amount, merchant, card_token, device_id, location, transaction_type,
       risk_score, risk_reason, decision, region, mode, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const synced = partitioned ? 0 : 1;

  stmt.run(
    transaction_id,
    amount,
    merchant.trim(),
    card_token.trim(),
    device_id.trim(),
    location.trim(),
    transaction_type.trim(),
    riskResult.score,
    reason,
    decision,
    region,
    mode,
    synced
  );

  // If partitioned, write to outbox for later synchronization
  if (partitioned) {
    addToOutbox(transaction_id, decision, region);
  }

  const savedTxn = db.prepare('SELECT * FROM transactions WHERE transaction_id = ?').get(transaction_id);

  return res.status(200).json({
    duplicate: false,
    transaction: savedTxn,
    fraud: {
      score: riskResult.score,
      level: riskResult.level,
      breakdown: riskResult.breakdown,
    },
    decision,
    reason,
    mode,
    region,
    partitioned,
  });
});

// ============================================================
// GET /api/transactions
// ============================================================
router.get('/transactions', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 100'
  ).all();
  res.json(rows);
});

// ============================================================
// GET /api/system-status
// ============================================================
router.get('/system-status', (req, res) => {
  const db = getDb();
  const partitioned = isPartitioned();
  const region = getActiveRegion();

  const counts = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN decision = 'APPROVED' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN decision = 'DECLINED' THEN 1 ELSE 0 END) as declined,
      SUM(CASE WHEN decision = 'REVIEW' THEN 1 ELSE 0 END) as review,
      SUM(CASE WHEN synced = 0 THEN 1 ELSE 0 END) as pending_sync,
      SUM(CASE WHEN risk_score >= 70 THEN 1 ELSE 0 END) as fraud_blocked
    FROM transactions
  `).get();

  res.json({
    network: partitioned ? 'PARTITIONED' : 'CONNECTED',
    mode: partitioned ? 'DEGRADED' : 'NORMAL',
    activeRegion: region,
    metrics: counts,
  });
});

// ============================================================
// POST /api/partition
// ============================================================
router.post('/partition', (req, res) => {
  if (isPartitioned()) {
    return res.status(400).json({ error: 'Network is already partitioned.' });
  }
  simulatePartition();
  res.json({ status: 'PARTITIONED', message: 'Network partition simulated. Regions are now isolated.' });
});

// ============================================================
// POST /api/restore
// ============================================================
router.post('/restore', (req, res) => {
  if (!isPartitioned()) {
    return res.status(400).json({ error: 'Network is not partitioned.' });
  }
  const result = restoreNetwork();
  res.json({
    status: 'CONNECTED',
    message: 'Network restored. Outbox replayed.',
    reconciliation: result,
  });
});

// ============================================================
// GET /api/outbox
// ============================================================
router.get('/outbox', (req, res) => {
  res.json(getOutbox());
});

// ============================================================
// POST /api/region — change active region
// ============================================================
router.post('/region', (req, res) => {
  const { region } = req.body;
  try {
    setActiveRegion(region);
    res.json({ activeRegion: region });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ============================================================
// POST /api/reconcile — manual trigger (alias for restore logic)
// ============================================================
router.post('/reconcile', (req, res) => {
  const db = getDb();
  const pending = db.prepare('SELECT * FROM outbox WHERE synced = 0').all();
  res.json({ pending_count: pending.length, outbox: pending });
});

module.exports = router;
