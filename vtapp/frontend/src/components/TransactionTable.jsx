// TransactionTable.jsx — Monitor table for all processed transactions.

import React from 'react';
import { ListFilter } from 'lucide-react';
import Tooltip from './Tooltip';

function DecisionBadge({ decision }) {
  const map = {
    APPROVED: 'badge-success',
    DECLINED: 'badge-danger',
    REVIEW:   'badge-warning',
    PENDING:  'badge-info',
  };
  return <span className={`badge ${map[decision] || 'badge-normal'}`}>{decision}</span>;
}

function ModeBadge({ mode }) {
  return (
    <span className={`badge ${mode === 'DEGRADED' ? 'badge-warning' : 'badge-normal'}`}>
      {mode}
    </span>
  );
}

function SyncBadge({ synced }) {
  return synced
    ? <span className="text-xs text-success font-medium">✓ Synced</span>
    : <span className="text-xs text-info font-medium sync-pulse">⟳ Pending</span>;
}

export default function TransactionTable({ transactions = [] }) {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <ListFilter size={16} className="text-brown-walnut" aria-hidden="true" />
        <h2 className="section-title">Transaction Monitor</h2>
        <Tooltip text="Every payment that has been processed — including its risk score, which region handled it, whether the system was in normal or degraded mode, and whether it's been synchronized across regions." />
      </div>

      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-xs" aria-label="Transaction monitor">
          <thead>
            <tr className="border-b border-brown-border bg-cream text-brown-muted text-left">
              <th className="px-5 py-2 font-semibold">Transaction ID</th>
              <th className="px-3 py-2 font-semibold">Amount</th>
              <th className="px-3 py-2 font-semibold">Risk</th>
              <th className="px-3 py-2 font-semibold">Region</th>
              <th className="px-3 py-2 font-semibold">Mode</th>
              <th className="px-3 py-2 font-semibold">Decision</th>
              <th className="px-3 py-2 font-semibold">Sync</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-brown-muted">
                  No transactions yet.
                </td>
              </tr>
            )}
            {transactions.map((t) => (
              <tr key={t.id} className="border-b border-brown-border/50 hover:bg-cream transition-colors animate-fade-in">
                <td className="px-5 py-2 font-mono text-espresso">{t.transaction_id}</td>
                <td className="px-3 py-2 font-semibold">₹{Number(t.amount).toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">
                  <span className={`font-bold ${t.risk_score >= 70 ? 'text-danger' : t.risk_score >= 40 ? 'text-warning' : 'text-success'}`}>
                    {t.risk_score}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono">{t.region}</td>
                <td className="px-3 py-2"><ModeBadge mode={t.mode} /></td>
                <td className="px-3 py-2"><DecisionBadge decision={t.decision} /></td>
                <td className="px-3 py-2"><SyncBadge synced={t.synced} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
