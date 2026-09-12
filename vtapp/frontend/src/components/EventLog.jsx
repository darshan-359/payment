// EventLog.jsx — Timestamped live event feed.

import React, { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import Tooltip from './Tooltip';

export default function EventLog({ events = [] }) {
  const bottomRef = useRef(null);

  // Auto-scroll to latest entry
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <Terminal size={16} className="text-brown-walnut" aria-hidden="true" />
        <h2 className="section-title">Live Event Log</h2>
        <Tooltip text="A real-time feed of every action the system takes — so you can follow exactly what happens step-by-step." />
      </div>

      <div
        className="bg-cream rounded-lg border border-brown-border overflow-y-auto max-h-56 divide-y divide-brown-border/40"
        role="log"
        aria-live="polite"
        aria-label="Live event log"
      >
        {events.length === 0 && (
          <p className="text-xs text-brown-muted text-center py-6">No events yet. Authorize a payment to begin.</p>
        )}
        {events.map((ev, i) => (
          <div key={i} className="log-entry animate-fade-in flex gap-3">
            <span className="text-brown-muted shrink-0 font-mono w-[70px]">{ev.time}</span>
            <span className={`flex-1 ${ev.type === 'error' ? 'text-danger' : ev.type === 'success' ? 'text-success' : ev.type === 'warn' ? 'text-warning' : ''}`}>
              {ev.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
