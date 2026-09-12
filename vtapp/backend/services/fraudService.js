// fraudService.js
// Computes a 0-100 risk score for each incoming transaction.
// Fraud screening always runs BEFORE authorization — this is a core design principle.

const { getDb } = require('../database');

// Merchant risk categories — in a real system this would be a DB table or external service.
const HIGH_RISK_MERCHANTS = ['gift marketplace', 'crypto exchange', 'wire transfer', 'money transfer'];
const MEDIUM_RISK_MERCHANTS = ['online casino', 'forex', 'auction', 'marketplace'];

// Device IDs known to be high risk (simulated)
const HIGH_RISK_DEVICES = ['DEV-RISK-9', 'DEV-RISK-7', 'DEV-UNKNOWN'];

/**
 * Compute a fraud risk score for the given transaction.
 * Returns { score: number, breakdown: object, level: 'LOW'|'MEDIUM'|'HIGH' }
 */
function computeRiskScore(txData, recentTxns) {
  const breakdown = {
    amount: { score: 0, status: 'PASS', label: 'Amount Check' },
    velocity: { score: 0, status: 'PASS', label: 'Velocity Check' },
    merchantRisk: { score: 0, status: 'LOW', label: 'Merchant Risk' },
    deviceRisk: { score: 0, status: 'LOW', label: 'Device Risk' },
    locationCheck: { score: 0, status: 'PASS', label: 'Location Check' },
  };

  let totalScore = 0;

  // --- 1. Amount-based risk ---
  // Large transactions are inherently riskier.
  if (txData.amount > 75000) {
    breakdown.amount.score = 35;
    breakdown.amount.status = 'FAIL';
  } else if (txData.amount > 25000) {
    breakdown.amount.score = 20;
    breakdown.amount.status = 'WARN';
  } else if (txData.amount > 10000) {
    breakdown.amount.score = 10;
    breakdown.amount.status = 'WARN';
  }
  totalScore += breakdown.amount.score;

  // --- 2. Velocity check ---
  // Count how many transactions this card token has done in the last 5 minutes (simulated window).
  const recentCount = recentTxns.filter(t => t.card_token === txData.card_token).length;
  if (recentCount >= 5) {
    breakdown.velocity.score = 30;
    breakdown.velocity.status = 'FAIL';
  } else if (recentCount >= 2) {
    breakdown.velocity.score = 15;
    breakdown.velocity.status = 'WARN';
  }
  totalScore += breakdown.velocity.score;

  // --- 3. Merchant risk ---
  const merchantLower = txData.merchant.toLowerCase();
  if (HIGH_RISK_MERCHANTS.some(m => merchantLower.includes(m))) {
    breakdown.merchantRisk.score = 20;
    breakdown.merchantRisk.status = 'HIGH';
  } else if (MEDIUM_RISK_MERCHANTS.some(m => merchantLower.includes(m))) {
    breakdown.merchantRisk.score = 10;
    breakdown.merchantRisk.status = 'MEDIUM';
  }
  totalScore += breakdown.merchantRisk.score;

  // --- 4. Device risk ---
  if (HIGH_RISK_DEVICES.includes(txData.device_id)) {
    breakdown.deviceRisk.score = 20;
    breakdown.deviceRisk.status = 'HIGH';
  }
  totalScore += breakdown.deviceRisk.score;

  // --- 5. Location mismatch check ---
  // If this card has recent transactions in a different city, flag it.
  const prevLocations = recentTxns
    .filter(t => t.card_token === txData.card_token)
    .map(t => t.location);
  const uniqueLocations = new Set(prevLocations);
  if (uniqueLocations.size > 0 && !prevLocations.includes(txData.location)) {
    breakdown.locationCheck.score = 15;
    breakdown.locationCheck.status = 'FAIL';
  }
  totalScore += breakdown.locationCheck.score;

  // Cap at 100
  totalScore = Math.min(totalScore, 100);

  const level = totalScore >= 70 ? 'HIGH' : totalScore >= 40 ? 'MEDIUM' : 'LOW';

  return { score: totalScore, breakdown, level };
}

/**
 * Run fraud screening on a transaction.
 * Fetches recent transactions for velocity and location checks, then returns risk result.
 */
function screenTransaction(txData) {
  const db = getDb();

  // Fetch recent transactions (last 60) for velocity / location context
  // Using parameterized query — no string interpolation
  const recentTxns = db.prepare(`
    SELECT card_token, location FROM transactions
    ORDER BY created_at DESC LIMIT 60
  `).all();

  return computeRiskScore(txData, recentTxns);
}

/**
 * Determine authorization decision based on risk and system mode.
 * This enforces that partition != auto-approve.
 */
function makeDecision(riskResult, txData, policy, isPartitioned) {
  const { score, level } = riskResult;

  if (level === 'HIGH') {
    return { decision: 'DECLINED', reason: 'HIGH_RISK_SCORE' };
  }

  if (isPartitioned) {
    // In degraded mode, we apply stricter rules:
    // We can't confirm velocity or full history remotely, so we require more confidence.
    if (level === 'MEDIUM') {
      return { decision: 'DECLINED', reason: 'INSUFFICIENT_EVIDENCE_PARTITION' };
    }
    if (txData.amount > policy.max_offline_amount) {
      return { decision: 'DECLINED', reason: 'EXCEEDS_OFFLINE_LIMIT' };
    }
    // LOW risk + within offline limit -> safe to approve in degraded mode
    return { decision: 'APPROVED', reason: 'LOCAL_POLICY_APPROVED' };
  }

  // Normal mode
  if (level === 'MEDIUM') {
    return { decision: 'REVIEW', reason: 'MEDIUM_RISK_REVIEW' };
  }

  return { decision: 'APPROVED', reason: 'NORMAL_APPROVED' };
}

module.exports = { screenTransaction, makeDecision };
