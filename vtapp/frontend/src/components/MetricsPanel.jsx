// MetricsPanel.jsx — Live updating system metrics cards.

import React from 'react';
import { Activity, CheckCircle, XCircle, ShieldX, Clock, Wifi } from 'lucide-react';

export default function MetricsPanel({ metrics = {}, mode = 'NORMAL' }) {
  const cards = [
    { icon: Activity,    label: 'Processed',    value: metrics.total       ?? 0, color: 'text-espresso' },
    { icon: CheckCircle, label: 'Approved',     value: metrics.approved    ?? 0, color: 'text-success' },
    { icon: XCircle,     label: 'Declined',     value: metrics.declined    ?? 0, color: 'text-danger' },
    { icon: ShieldX,     label: 'Fraud Blocked',value: metrics.fraud_blocked ?? 0, color: 'text-warning' },
    { icon: Clock,       label: 'Pending Sync', value: metrics.pending_sync ?? 0, color: 'text-info' },
    { icon: Wifi,        label: 'Mode',         value: mode,                    color: mode === 'DEGRADED' ? 'text-danger' : 'text-success', isText: true },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {cards.map(({ icon: Icon, label, value, color, isText }) => (
        <div key={label} className="card flex items-center gap-3">
          <div className={`${color} opacity-80`}>
            <Icon size={20} aria-hidden="true" />
          </div>
          <div>
            <div className={`font-bold text-lg leading-tight ${color} ${isText ? 'text-sm' : ''}`}>
              {isText ? value : value.toLocaleString()}
            </div>
            <div className="text-xs text-brown-muted">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
