// RiskMeter.jsx
// Visual fraud risk indicator: green bar (LOW), amber (MEDIUM), red (HIGH).

import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

const LEVELS = {
  LOW:    { label: 'LOW RISK',    color: 'bg-success', textColor: 'text-success',  Icon: ShieldCheck },
  MEDIUM: { label: 'MEDIUM RISK', color: 'bg-warning', textColor: 'text-warning',  Icon: ShieldAlert },
  HIGH:   { label: 'HIGH RISK',   color: 'bg-danger',  textColor: 'text-danger',   Icon: ShieldX },
};

export default function RiskMeter({ score = 0, level = 'LOW', breakdown = {} }) {
  const { label, color, textColor, Icon } = LEVELS[level] || LEVELS.LOW;
  const pct = Math.min(Math.max(score, 0), 100);

  return (
    <div className="space-y-4">
      {/* Score display */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={20} className={textColor} aria-hidden="true" />
          <span className={`text-sm font-bold ${textColor}`}>{label}</span>
        </div>
        <span className="text-2xl font-bold text-espresso font-mono">
          {score}<span className="text-sm text-brown-muted font-normal"> / 100</span>
        </span>
      </div>

      {/* Bar */}
      <div className="risk-bar-track" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100} aria-label={`Risk score: ${score} out of 100`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Zone labels */}
      <div className="flex text-xs text-brown-muted font-medium">
        <span className="flex-1 text-success">LOW (0–39)</span>
        <span className="flex-1 text-center text-warning">MEDIUM (40–69)</span>
        <span className="flex-1 text-right text-danger">HIGH (70–100)</span>
      </div>

      {/* Breakdown table */}
      {Object.keys(breakdown).length > 0 && (
        <div className="mt-2 space-y-1.5">
          {Object.entries(breakdown).map(([key, item]) => (
            <div key={key} className="flex items-center justify-between text-xs">
              <span className="text-brown-muted">{item.label}</span>
              <span className={`font-semibold ${
                item.status === 'FAIL' || item.status === 'HIGH' ? 'text-danger' :
                item.status === 'WARN' || item.status === 'MEDIUM' ? 'text-warning' :
                'text-success'
              }`}>
                {item.status === 'FAIL' ? '✕ FAIL' :
                 item.status === 'WARN' || item.status === 'MEDIUM' ? '⚠ WARN' :
                 item.status === 'HIGH' ? '✕ HIGH' :
                 '✓ PASS'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
