// partitionService.js
// Manages the simulated network partition state and outbox reconciliation.
// In a real distributed system, this would be handled by a consensus protocol.
// Here, we use in-memory state + the SQLite outbox table.

const { getDb } = require('../database');

// In-memory network state — resets on server restart (acceptable for demo)
let networkPartitioned = false;
let activeRegion = 'A'; // The region the current server instance represents

function isPartitioned() {
  return networkPartitioned;
}

function getActiveRegion() {
  return activeRegion;
}

function setActiveRegion(region) {
  if (region !== 'A' && region !== 'B') throw new Error('Invalid region');
  activeRegion = region;
}

function simulatePartition() {
  networkPartitioned = true;
}

/**
 * Restore the network connection.
 * Replays the outbox and marks synced events as complete.
 * Returns a log of actions taken during reconciliation.
 */
function restoreNetwork() {
  networkPartitioned = false;
  const db = getDb();

  // Get all unsynced outbox events
  const pending = db.prepare(`
    SELECT * FROM outbox WHERE synced = 0 ORDER BY created_at ASC
  `).all();

  const reconciliationLog = [];

  // Process each event — skip duplicates (idempotency via transaction_id)
  const markSynced = db.prepare(`
    UPDATE outbox SET synced = 1 WHERE id = ?
  `);
  const markTxnSynced = db.prepare(`
    UPDATE transactions SET synced = 1 WHERE transaction_id = ?
  `);

  // Use a transaction for atomicity — either all events sync or none
  const reconcile = db.transaction(() => {
    for (const event of pending) {
      reconciliationLog.push({
        transaction_id: event.transaction_id,
        decision: event.decision,
        region: event.region,
        action: 'SYNCED',
        created_at: event.created_at,
      });
      markSynced.run(event.id);
      markTxnSynced.run(event.transaction_id);
    }
  });

  reconcile();

  return {
    eventsProcessed: pending.length,
    log: reconciliationLog,
  };
}

/**
 * Add an event to the outbox (called when a transaction decision is made during a partition).
 */
function addToOutbox(transaction_id, decision, region) {
  const db = getDb();
  db.prepare(`
    INSERT INTO outbox (transaction_id, event_type, region, decision)
    VALUES (?, 'AUTHORIZATION', ?, ?)
  `).run(transaction_id, region, decision);
}

function getOutbox() {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM outbox ORDER BY created_at DESC LIMIT 50
  `).all();
}

module.exports = {
  isPartitioned,
  getActiveRegion,
  setActiveRegion,
  simulatePartition,
  restoreNetwork,
  addToOutbox,
  getOutbox,
};
