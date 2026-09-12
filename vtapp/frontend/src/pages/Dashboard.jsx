// Dashboard.jsx
// Main dashboard page — assembles all components and manages application state.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Zap, Wifi, WifiOff, RefreshCw, Play, ChevronRight,
  AlertTriangle, CheckCircle, XCircle
} from 'lucide-react';

import LiquidButton from '../components/LiquidButton';
import RiskMeter from '../components/RiskMeter';
import FlowDiagram from '../components/FlowDiagram';
import NetworkDiagram from '../components/NetworkDiagram';
import MetricsPanel from '../components/MetricsPanel';
import EventLog from '../components/EventLog';
import TransactionTable from '../components/TransactionTable';
import OutboxPanel from '../components/OutboxPanel';
import Tooltip from '../components/Tooltip';

import * as api from '../services/api';

// ── Demo scenarios (§10) ──────────────────────────────────────────────────────
const DEMO_SCENARIOS = [
  {
    id: 1,
    title: 'Normal Approval',
    description: '₹2,500 low-risk purchase. Expected: APPROVED / NORMAL MODE',
    action: 'authorize',
    payload: {
      transaction_id: `DEMO-${Date.now()}-1`,
      amount: 2500,
      merchant: 'ABC Electronics',
      card_token: '**** **** **** 4821',
      device_id: 'DEV-42',
      location: 'Hyderabad',
      transaction_type: 'Purchase',
    },
  },
  {
    id: 2,
    title: 'Fraud Detection',
    description: '₹90,000 high-risk purchase. Expected: DECLINED / HIGH RISK',
    action: 'authorize',
    payload: {
      transaction_id: `DEMO-${Date.now()}-2`,
      amount: 90000,
      merchant: 'Gift Marketplace',
      card_token: '**** **** **** 1740',
      device_id: 'DEV-RISK-9',
      location: 'Delhi',
      transaction_type: 'Purchase',
    },
  },
  {
    id: 3,
    title: 'Partition + Safe Approval',
    description: 'Activates partition, then ₹3,000 low-risk. Expected: APPROVED / DEGRADED MODE / PENDING SYNC',
    action: 'partition_then_authorize',
    payload: {
      transaction_id: `DEMO-${Date.now()}-3`,
      amount: 3000,
      merchant: 'ABC Electronics',
      card_token: '**** **** **** 4821',
      device_id: 'DEV-42',
      location: 'Hyderabad',
      transaction_type: 'Purchase',
    },
  },
  {
    id: 4,
    title: 'Partition + Risky Transaction',
    description: 'Partition active, ₹75,000 high risk. Expected: DECLINED / HIGH RISK',
    action: 'authorize',
    payload: {
      transaction_id: `DEMO-${Date.now()}-4`,
      amount: 75000,
      merchant: 'Gift Marketplace',
      card_token: '**** **** **** 9999',
      device_id: 'DEV-RISK-7',
      location: 'Mumbai',
      transaction_type: 'Purchase',
    },
  },
  {
    id: 5,
    title: 'Network Recovery',
    description: 'Restores network, replays outbox, reconciles regions. Expected: SYNCHRONIZED / NORMAL MODE',
    action: 'restore',
    payload: null,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timestamp() {
  return new Date().toLocaleTimeString('en-IN', { hour12: false });
}

function addLog(setLogs, message, type = 'info') {
  setLogs(prev => [...prev.slice(-99), { time: timestamp(), message, type }]);
}

const EMPTY_FORM = {
  transaction_id: '',
  amount: '',
  merchant: '',
  card_token: '',
  device_id: '',
  location: '',
  transaction_type: 'Purchase',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState([]);

  // Latest auth result
  const [authResult, setAuthResult] = useState(null);
  const [flowStep, setFlowStep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState(false);

  // System state
  const [status, setStatus] = useState({ network: 'CONNECTED', mode: 'NORMAL', activeRegion: 'A', metrics: {} });
  const [transactions, setTransactions] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [logs, setLogs] = useState([]);
  const [reconciliation, setReconciliation] = useState(null);

  // Guided demo
  const [demoStep, setDemoStep] = useState(null); // null = not in demo
  const [demoCaption, setDemoCaption] = useState('');

  const partitioned = status.network === 'PARTITIONED';

  // ── Polling ────────────────────────────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    try {
      const [s, txns, ob] = await Promise.all([
        api.getSystemStatus(),
        api.getTransactions(),
        api.getOutbox(),
      ]);
      setStatus(s);
      setTransactions(txns);
      setOutbox(ob);
    } catch {
      // Silently fail — backend may not be running yet
    }
  }, []);

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 4000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  // ── Authorize ─────────────────────────────────────────────────────────────
  async function handleAuthorize(e) {
    if (e) e.preventDefault();
    setFormErrors([]);
    setAuthResult(null);
    setDuplicate(false);
    setReconciliation(null);

    const payload = {
      ...form,
      amount: parseFloat(form.amount),
    };

    // Basic client-side pre-validation
    const errors = [];
    if (!payload.transaction_id) errors.push('Transaction ID is required');
    if (!payload.amount || payload.amount <= 0) errors.push('Amount must be a positive number');
    if (!payload.merchant) errors.push('Merchant is required');
    if (!payload.card_token) errors.push('Card token is required');
    if (!payload.device_id) errors.push('Device ID is required');
    if (!payload.location) errors.push('Location is required');

    if (errors.length) { setFormErrors(errors); return; }

    setLoading(true);

    try {
      setFlowStep('request');
      addLog(setLogs, `Payment ${payload.transaction_id} received`, 'info');
      await pause(300);

      setFlowStep('fraud');
      addLog(setLogs, `Running fraud screening on ${payload.transaction_id}…`, 'info');
      await pause(400);

      const result = await api.authorize(payload);

      if (result.duplicate) {
        setDuplicate(true);
        setAuthResult(result);
        setFlowStep('result');
        addLog(setLogs, `Duplicate request ${payload.transaction_id} — returned cached result`, 'warn');
        return;
      }

      setFlowStep('decision');
      addLog(setLogs, `Fraud score calculated: ${result.fraud.score} (${result.fraud.level})`, result.fraud.level === 'HIGH' ? 'error' : 'info');
      await pause(300);

      setFlowStep('auth');
      addLog(setLogs, `${result.mode} mode — making authorization decision…`, 'info');
      await pause(300);

      setFlowStep('result');
      addLog(setLogs, `Payment ${result.decision}`, result.decision === 'APPROVED' ? 'success' : 'error');

      if (result.partitioned) {
        addLog(setLogs, `Event added to outbox (pending sync)`, 'warn');
      }

      setAuthResult(result);
      await refreshAll();

    } catch (err) {
      setFlowStep(null);
      addLog(setLogs, `Error: ${err.message}`, 'error');
      setFormErrors([err.message]);
    } finally {
      setLoading(false);
      setTimeout(() => setFlowStep(null), 2000);
    }
  }

  async function handlePartition() {
    try {
      await api.simulatePartition();
      addLog(setLogs, 'Network partition simulated — regions now isolated', 'warn');
      await refreshAll();
    } catch (err) {
      addLog(setLogs, `Partition error: ${err.message}`, 'error');
    }
  }

  async function handleRestore() {
    try {
      addLog(setLogs, 'Restoring network connection…', 'info');
      const result = await api.restoreNetwork();
      setReconciliation(result.reconciliation);
      addLog(setLogs, `Network restored — ${result.reconciliation.eventsProcessed} outbox event(s) replayed`, 'success');
      addLog(setLogs, 'Synchronization complete — SYSTEM: NORMAL', 'success');
      await refreshAll();
    } catch (err) {
      addLog(setLogs, `Restore error: ${err.message}`, 'error');
    }
  }

  async function handleRegionChange(region) {
    try {
      await api.setRegion(region);
      addLog(setLogs, `Active region switched to ${region}`, 'info');
      await refreshAll();
    } catch (err) {
      addLog(setLogs, `Region error: ${err.message}`, 'error');
    }
  }

  // ── Guided Demo ────────────────────────────────────────────────────────────
  async function runDemo(scenarioIndex) {
    const scenario = DEMO_SCENARIOS[scenarioIndex];
    if (!scenario) { setDemoStep(null); return; }

    setDemoStep(scenarioIndex);
    setDemoCaption(`Step ${scenario.id}: ${scenario.title} — ${scenario.description}`);
    await pause(800);

    // Generate a fresh transaction ID per run to avoid idempotency collisions
    const freshId = `DEMO-${Date.now()}-${scenario.id}`;

    if (scenario.action === 'authorize') {
      const payload = { ...scenario.payload, transaction_id: freshId };
      setForm({ ...payload, amount: String(payload.amount) });
      await pause(400);
      await handleAuthorizeWithPayload(payload);
    } else if (scenario.action === 'partition_then_authorize') {
      if (!partitioned) await handlePartition();
      await pause(600);
      const payload = { ...scenario.payload, transaction_id: freshId };
      setForm({ ...payload, amount: String(payload.amount) });
      await pause(400);
      await handleAuthorizeWithPayload(payload);
    } else if (scenario.action === 'restore') {
      await handleRestore();
    }

    // Advance to next scenario after a pause
    await pause(1500);
    if (scenarioIndex + 1 < DEMO_SCENARIOS.length) {
      runDemo(scenarioIndex + 1);
    } else {
      setDemoStep(null);
      setDemoCaption('');
      addLog(setLogs, '— Guided demo complete —', 'success');
    }
  }

  // Helper: authorize with explicit payload (bypasses form state)
  async function handleAuthorizeWithPayload(payload) {
    setAuthResult(null);
    setDuplicate(false);
    setLoading(true);
    try {
      setFlowStep('request');
      addLog(setLogs, `Payment ${payload.transaction_id} received`, 'info');
      await pause(300);
      setFlowStep('fraud');
      addLog(setLogs, `Running fraud screening…`, 'info');
      await pause(400);
      const result = await api.authorize({ ...payload, amount: parseFloat(payload.amount) });
      setFlowStep('decision');
      addLog(setLogs, `Fraud score: ${result.fraud?.score} (${result.fraud?.level})`, result.fraud?.level === 'HIGH' ? 'error' : 'info');
      await pause(300);
      setFlowStep('auth');
      await pause(300);
      setFlowStep('result');
      addLog(setLogs, `Payment ${result.decision}`, result.decision === 'APPROVED' ? 'success' : 'error');
      if (result.partitioned) addLog(setLogs, `Event added to outbox`, 'warn');
      setAuthResult(result);
      await refreshAll();
    } catch (err) {
      addLog(setLogs, `Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setTimeout(() => setFlowStep(null), 2000);
    }
  }

  function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-cream">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-brown-border bg-cream-warm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brown-walnut rounded-lg flex items-center justify-center">
              <Zap size={16} className="text-cream" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-bold text-espresso leading-none">QuorumGuard</h1>
              <p className="text-[10px] text-brown-muted">Partition-Aware Payment Authorization</p>
            </div>
          </div>

          {/* System status badge */}
          <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border
            ${partitioned
              ? 'bg-danger/10 border-danger/30 text-danger'
              : 'bg-success/10 border-success/30 text-success'}`}
            role="status" aria-live="polite"
          >
            <span className={`status-dot ${partitioned ? 'bg-danger' : 'bg-success'}`} />
            SYSTEM: {partitioned ? 'DEGRADED MODE' : 'NORMAL'}
          </div>

          {/* Main network controls */}
          <div className="flex gap-2">
            {!partitioned
              ? <LiquidButton variant="danger" onClick={handlePartition} aria-label="Simulate network partition">
                  <WifiOff size={14} aria-hidden="true" /> Simulate Partition
                </LiquidButton>
              : <LiquidButton variant="success" onClick={handleRestore} aria-label="Restore network connection">
                  <Wifi size={14} aria-hidden="true" /> Restore Network
                </LiquidButton>
            }
          </div>
        </div>
      </header>

      {/* ── Partition banner ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {partitioned && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-danger/10 border-b border-danger/30 overflow-hidden"
            role="alert"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2 text-danger text-sm font-semibold">
              <AlertTriangle size={15} aria-hidden="true" />
              NETWORK PARTITION DETECTED — Inter-region communication unavailable. Both regions are operating independently using locally cached policy.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Guided demo caption ────────────────────────────────────────────── */}
      <AnimatePresence>
        {demoCaption && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-info/10 border-b border-info/30 text-info text-sm px-4 sm:px-6 py-2 max-w-7xl mx-auto"
          >
            🎬 {demoCaption}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── System Metrics ─────────────────────────────────────────────── */}
        <MetricsPanel metrics={status.metrics} mode={status.mode} />

        {/* ── Two-column layout: Payment form + Fraud result ────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Payment Authorization Form ─────────────────────────────── */}
          <section className="card" aria-labelledby="auth-heading">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard size={16} className="text-brown-walnut" aria-hidden="true" />
              <h2 id="auth-heading" className="section-title">Payment Authorization</h2>
              <Tooltip text="Submit a payment for authorization. The system will screen it for fraud before making a decision." />
            </div>

            <form onSubmit={handleAuthorize} noValidate className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label" htmlFor="txn-id">Transaction ID</label>
                  <input id="txn-id" className="form-input" placeholder="TXN-1001"
                    value={form.transaction_id}
                    onChange={e => setForm(f => ({ ...f, transaction_id: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label" htmlFor="amount">Amount (₹)</label>
                  <input id="amount" className="form-input" type="number" placeholder="2500" min="1"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="form-label" htmlFor="merchant">Merchant</label>
                <input id="merchant" className="form-input" placeholder="ABC Electronics"
                  value={form.merchant}
                  onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label" htmlFor="card-token">
                    Card Token
                    <Tooltip text="We only accept masked/tokenized card references — never real card numbers. This is non-negotiable for security." />
                  </label>
                  <input id="card-token" className="form-input" placeholder="**** **** **** 4821"
                    value={form.card_token}
                    onChange={e => setForm(f => ({ ...f, card_token: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label" htmlFor="device-id">Device ID</label>
                  <input id="device-id" className="form-input" placeholder="DEV-42"
                    value={form.device_id}
                    onChange={e => setForm(f => ({ ...f, device_id: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label" htmlFor="location">Location</label>
                  <input id="location" className="form-input" placeholder="Hyderabad"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label" htmlFor="txn-type">Transaction Type</label>
                  <select id="txn-type" className="form-input"
                    value={form.transaction_type}
                    onChange={e => setForm(f => ({ ...f, transaction_type: e.target.value }))}>
                    <option>Purchase</option>
                    <option>Refund</option>
                    <option>Transfer</option>
                    <option>Withdrawal</option>
                  </select>
                </div>
              </div>

              {formErrors.length > 0 && (
                <ul className="text-xs text-danger space-y-0.5 bg-danger/5 rounded-lg px-3 py-2" role="alert">
                  {formErrors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}

              {/* Active region selector */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs text-brown-muted font-medium">Active Region:</span>
                {['A', 'B'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRegionChange(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all
                      ${status.activeRegion === r
                        ? 'bg-brown-walnut text-cream border-brown-walnut'
                        : 'bg-cream border-brown-border text-brown-muted hover:border-brown-walnut'}`}
                    aria-pressed={status.activeRegion === r}
                  >
                    Region {r}
                  </button>
                ))}
              </div>

              <LiquidButton type="submit" loading={loading} className="w-full justify-center" aria-label="Authorize payment">
                <CreditCard size={15} aria-hidden="true" />
                Authorize Payment
              </LiquidButton>
            </form>
          </section>

          {/* ── Fraud Screening / Result ───────────────────────────────── */}
          <section className="card" aria-labelledby="fraud-heading">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-brown-walnut" aria-hidden="true" />
              <h2 id="fraud-heading" className="section-title">
                Inline Fraud Screening
                <Tooltip text="Fraud is checked before authorization, every single time. The payment cannot proceed until this check completes." />
              </h2>
            </div>

            {/* Processing flow */}
            <FlowDiagram activeStep={flowStep} />

            <div className="mt-4">
              {!authResult && !loading && (
                <p className="text-sm text-brown-muted text-center py-8">
                  Submit a payment to see the fraud screening result here.
                </p>
              )}

              {loading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-8 h-8 border-3 border-brown-walnut border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  <p className="text-sm text-brown-muted">Processing…</p>
                </div>
              )}

              {authResult && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Duplicate notice */}
                  {duplicate && (
                    <div className="bg-info/10 border border-info/30 rounded-lg px-4 py-3 text-sm" role="alert">
                      <p className="font-semibold text-info">DUPLICATE REQUEST</p>
                      <p className="text-xs text-brown-muted mt-1">
                        Returning previous authorization result.
                        <Tooltip text="Idempotency prevents duplicate charges when clients retry during unreliable network conditions. Same transaction ID = same result, always." />
                      </p>
                    </div>
                  )}

                  {/* Decision banner */}
                  <div className={`rounded-lg px-4 py-3 flex items-center gap-3
                    ${authResult.decision === 'APPROVED' ? 'bg-success/10 border border-success/30' :
                      authResult.decision === 'REVIEW' ? 'bg-warning/10 border border-warning/30' :
                      'bg-danger/10 border border-danger/30'}`}
                    role="status"
                  >
                    {authResult.decision === 'APPROVED'
                      ? <CheckCircle size={20} className="text-success" />
                      : authResult.decision === 'REVIEW'
                      ? <AlertTriangle size={20} className="text-warning" />
                      : <XCircle size={20} className="text-danger" />}
                    <div>
                      <p className={`font-bold text-sm ${authResult.decision === 'APPROVED' ? 'text-success' : authResult.decision === 'REVIEW' ? 'text-warning' : 'text-danger'}`}>
                        {authResult.decision} — {authResult.mode || authResult.transaction?.mode}
                      </p>
                      <p className="text-xs text-brown-muted">{authResult.reason}</p>
                    </div>
                  </div>

                  {/* Risk meter */}
                  {authResult.fraud && (
                    <RiskMeter
                      score={authResult.fraud.score}
                      level={authResult.fraud.level}
                      breakdown={authResult.fraud.breakdown}
                    />
                  )}
                </motion.div>
              )}
            </div>
          </section>
        </div>

        {/* ── Distributed System Simulation ─────────────────────────────── */}
        <section className="card" aria-labelledby="dist-heading">
          <div className="flex items-center gap-2 mb-2">
            <h2 id="dist-heading" className="section-title">Distributed System — Region View</h2>
            <Tooltip text="Two independent regions that normally stay in sync. During a partition, they operate separately and reconcile when the connection is restored." />
          </div>
          <p className="section-sub mb-3">System Health / Network Status</p>
          <NetworkDiagram partitioned={partitioned} activeRegion={status.activeRegion} />
        </section>

        {/* ── Reconciliation result ─────────────────────────────────────── */}
        <AnimatePresence>
          {reconciliation && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card bg-success/5 border-success/30"
              aria-labelledby="recon-heading"
              role="status"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-success" />
                <h2 id="recon-heading" className="section-title text-success">Synchronization Complete</h2>
              </div>
              <p className="text-xs text-brown-muted mb-3">
                REGIONS: SYNCHRONIZED — {reconciliation.eventsProcessed} event(s) replayed from the outbox.
                <Tooltip text="All events that were queued during the partition have now been applied. Both regions agree on the same state — this is called eventual consistency." />
              </p>
              {reconciliation.log.map((ev, i) => (
                <div key={i} className="font-mono text-xs text-espresso flex gap-3 py-1 border-b border-success/20">
                  <span className="text-brown-muted">{ev.transaction_id}</span>
                  <span className={ev.decision === 'APPROVED' ? 'text-success' : 'text-danger'}>{ev.decision}</span>
                  <span className="text-brown-muted">Region {ev.region}</span>
                  <span className="ml-auto text-success">✓ SYNCED</span>
                </div>
              ))}
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Demo Scenarios ─────────────────────────────────────────────── */}
        <section className="card" aria-labelledby="demo-heading">
          <div className="flex items-center gap-2 mb-4">
            <Play size={16} className="text-brown-walnut" aria-hidden="true" />
            <h2 id="demo-heading" className="section-title">Demo Scenarios</h2>
            <Tooltip text="One-click presets that walk through all five key scenarios. The Guided Demo button runs them all automatically in order." />
            <button
              className="ml-auto btn-primary text-xs px-4 py-1.5 flex items-center gap-1"
              onClick={() => runDemo(0)}
              disabled={demoStep !== null}
              aria-label="Start guided demo"
            >
              <Play size={12} aria-hidden="true" />
              {demoStep !== null ? 'Running…' : 'Guided Demo'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DEMO_SCENARIOS.map((s, i) => (
              <button
                key={s.id}
                className="text-left card hover:shadow-card-hover hover:border-brown-walnut/30 transition-all duration-200 group"
                onClick={() => runDemo(i)}
                disabled={loading || demoStep !== null}
                aria-label={`Run demo scenario: ${s.title}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono font-bold text-brown-walnut bg-cream px-2 py-0.5 rounded border border-brown-border">
                    {String(s.id).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-espresso group-hover:text-brown-walnut transition-colors">{s.title}</p>
                    <p className="text-xs text-brown-muted mt-0.5 leading-relaxed">{s.description}</p>
                  </div>
                  <ChevronRight size={14} className="ml-auto text-brown-muted group-hover:text-brown-walnut transition-colors shrink-0 mt-0.5" aria-hidden="true" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Outbox ─────────────────────────────────────────────────────── */}
        <OutboxPanel outbox={outbox} />

        {/* ── Transaction Monitor ────────────────────────────────────────── */}
        <TransactionTable transactions={transactions} />

        {/* ── Event Log ─────────────────────────────────────────────────── */}
        <EventLog events={logs} />

      </main>

      <footer className="border-t border-brown-border mt-8 py-4 text-center text-xs text-brown-muted">
        QuorumGuard — Academic Distributed Systems Prototype. No real card data is stored.
      </footer>
    </div>
  );
}
