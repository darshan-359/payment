// database.js
// Initializes the SQLite database using better-sqlite3 with strict parameterized queries.
// The DB file lives in /data, which is NOT exposed via any static file route.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'quorumguard.db');

// Ensure the /data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  // transactions table: stores each payment authorization attempt
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL UNIQUE, -- idempotency key — unique constraint at DB level
      amount REAL NOT NULL,
      merchant TEXT NOT NULL,
      card_token TEXT NOT NULL,            -- masked token only, e.g. **** **** **** 4821
      device_id TEXT NOT NULL,
      location TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      risk_score INTEGER NOT NULL DEFAULT 0,
      risk_reason TEXT,
      decision TEXT NOT NULL DEFAULT 'PENDING',  -- APPROVED | DECLINED | REVIEW | PENDING
      region TEXT NOT NULL DEFAULT 'A',
      mode TEXT NOT NULL DEFAULT 'NORMAL',        -- NORMAL | DEGRADED
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 1           -- 0 = pending sync (created during partition)
    );
  `);

  // outbox table: durable queue for events that couldn't replicate during a partition
  db.exec(`
    CREATE TABLE IF NOT EXISTS outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT NOT NULL,
      event_type TEXT NOT NULL DEFAULT 'AUTHORIZATION',
      region TEXT NOT NULL,
      decision TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0
    );
  `);

  // policies table: cached authorization policy used when operating in DEGRADED mode
  db.exec(`
    CREATE TABLE IF NOT EXISTS policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL DEFAULT 1,
      max_offline_amount REAL NOT NULL DEFAULT 10000,
      high_risk_threshold INTEGER NOT NULL DEFAULT 70,
      medium_risk_threshold INTEGER NOT NULL DEFAULT 40,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Seed a default policy if none exists
  const policy = db.prepare('SELECT id FROM policies LIMIT 1').get();
  if (!policy) {
    db.prepare(`
      INSERT INTO policies (version, max_offline_amount, high_risk_threshold, medium_risk_threshold)
      VALUES (1, 10000, 70, 40)
    `).run();
  }
}

module.exports = { getDb };
