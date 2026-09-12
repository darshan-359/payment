// NetworkDiagram.jsx
// SVG/HTML diagram showing the two-region architecture and the network connection state.
// The line animates to a dashed broken form during a partition.

import React from 'react';
import { Database, Shield, Cpu, Inbox } from 'lucide-react';

function RegionBox({ label, isActive, isPartitioned, side }) {
  return (
    <div className={`flex flex-col items-center gap-1.5 p-4 rounded-card border-2 min-w-[140px]
                    transition-all duration-300
                    ${isActive ? 'border-brown-walnut bg-cream' : 'border-brown-border bg-cream-warm'}
                    ${isPartitioned ? 'opacity-90' : ''}`}>
      <div className={`text-xs font-bold tracking-widest uppercase mb-1
                       ${isActive ? 'text-brown-walnut' : 'text-brown-muted'}`}>
        {label}
        {isActive && <span className="ml-1 text-[10px] text-success">(active)</span>}
      </div>
      <div className="flex flex-col gap-1 w-full text-[11px] text-brown-muted">
        <NodeRow icon={<Cpu size={11} />} label="API Gateway" />
        <NodeRow icon={<Shield size={11} />} label="Auth Service" />
        <NodeRow icon={<Shield size={11} />} label="Fraud Service" />
        <NodeRow icon={<Database size={11} />} label="Local DB" />
        <NodeRow icon={<Inbox size={11} />} label="Outbox" />
      </div>
    </div>
  );
}

function NodeRow({ icon, label }) {
  return (
    <div className="flex items-center gap-1.5 bg-cream-warm rounded px-2 py-0.5">
      <span className="text-brown-muted">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default function NetworkDiagram({ partitioned, activeRegion }) {
  return (
    <div className="flex items-center justify-center gap-4 py-4 flex-wrap">
      <RegionBox label="Region A" isActive={activeRegion === 'A'} isPartitioned={partitioned} side="left" />

      {/* Network connection line */}
      <div className="flex flex-col items-center gap-1 min-w-[120px]">
        <svg width="120" height="40" aria-label={partitioned ? 'Network partitioned — regions disconnected' : 'Network connected'}>
          {partitioned ? (
            <>
              {/* Broken dashed line */}
              <line
                x1="0" y1="20" x2="45" y2="20"
                stroke="#A2432E" strokeWidth="2.5" strokeDasharray="6,4"
                className="partition-line"
              />
              <text x="55" y="25" fontSize="12" fill="#A2432E" fontWeight="bold">✕</text>
              <line
                x1="75" y1="20" x2="120" y2="20"
                stroke="#A2432E" strokeWidth="2.5" strokeDasharray="6,4"
                className="partition-line"
              />
            </>
          ) : (
            <line x1="0" y1="20" x2="120" y2="20" stroke="#4C7A4C" strokeWidth="2.5" />
          )}
        </svg>
        <span className={`text-xs font-semibold ${partitioned ? 'text-danger' : 'text-success'}`}>
          {partitioned ? 'PARTITIONED' : 'CONNECTED'}
        </span>
      </div>

      <RegionBox label="Region B" isActive={activeRegion === 'B'} isPartitioned={partitioned} side="right" />
    </div>
  );
}
