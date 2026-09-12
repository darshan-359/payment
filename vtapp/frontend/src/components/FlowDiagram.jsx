// FlowDiagram.jsx
// Shows the payment processing flow: Request → Fraud → Decision → Auth → Result
// Highlights the active step in real-time.

import React from 'react';
import { ArrowRight } from 'lucide-react';

const STEPS = [
  { id: 'request',     label: 'Payment Request' },
  { id: 'fraud',       label: 'Fraud Screening' },
  { id: 'decision',    label: 'Risk Decision' },
  { id: 'auth',        label: 'Authorization' },
  { id: 'result',      label: 'Final Result' },
];

export default function FlowDiagram({ activeStep = null }) {
  return (
    <div className="flex items-center gap-1 flex-wrap justify-center my-2">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.id}>
          <div
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-300
              ${activeStep === step.id
                ? 'bg-brown-walnut text-cream shadow-md scale-105'
                : 'bg-cream border border-brown-border text-brown-muted'}`}
            aria-current={activeStep === step.id ? 'step' : undefined}
          >
            {step.label}
          </div>
          {i < STEPS.length - 1 && (
            <ArrowRight size={14} className="text-brown-border flex-shrink-0" aria-hidden="true" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
