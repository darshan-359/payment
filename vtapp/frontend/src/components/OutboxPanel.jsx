// OutboxPanel.jsx — Shows events queued during a partition, pending synchronization.

import React from 'react';
import { Inbox } from 'lucide-react';
import Tooltip from './Tooltip';

export default function OutboxPanel({ outbox = [] }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Inbox size={16} className="text-brown-walnut" aria-hidden="true" />
        <h2 className="section-title">Outbox</h2>
        <Tooltip text='A safe "waiting room" for events that couldn\'t reach the other region yet during a partition. Nothing is lost — they\'re replayed once the connection is restored.' />
        <span className="ml-auto badge badge-info">{outbox.filter(e => !e.synced).length} pending</span>
      </div>

      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-xs" aria-label="Outbox events">
          <thead>
            <tr className="border-b border-brown-border bg-cream text-brown-muted text-left">
              <th className="px-5 py-2 font-semibold">Transaction ID</th>
              <th className="px-3 py-2 font-semibold">Decision</th>
              <th className="px-3 py-2 font-semibold">Region</th>
              <th className="px-3 py-2 font-semibold">Timestamp</th>
              <th className="px-3 py-2 font-semibold">Sync Status</th>
            </tr>
          </thead>
          <tbody>
            {outbox.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-brown-muted">Outbox is empty.</td></tr>
            )}
            {outbox.map(ev => (
              <tr key={ev.id} className="border-b border-brown-border/50 hover:bg-cream transition-colors">
                <td className="px-5 py-2 font-mono">{ev.transaction_id}</td>
                <td className="px-3 py-2">
                  <span className={`badge ${ev.decision === 'APPROVED' ? 'badge-success' : 'badge-danger'}`}>
                    {ev.decision}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono">{ev.region}</td>
                <td className="px-3 py-2 font-mono text-brown-muted">{ev.created_at?.slice(11, 19)}</td>
                <td className="px-3 py-2">
                  {ev.synced
                    ? <span className="text-success font-medium">✓ Synced</span>
                    : <span className="text-info font-medium sync-pulse">⟳ Pending</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
