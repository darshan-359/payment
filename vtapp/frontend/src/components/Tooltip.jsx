// Tooltip.jsx — A small "?" icon that shows a plain-language explanation on hover.
// Used throughout the app to demystify distributed-systems jargon.

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export default function Tooltip({ text }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        aria-label={`Explanation: ${text}`}
        className="text-brown-muted hover:text-brown-walnut transition-colors focus-visible:ring-1"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        type="button"
      >
        <HelpCircle size={13} />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-espresso text-cream
                     text-xs rounded-lg px-3 py-2 shadow-lg z-50 leading-relaxed pointer-events-none
                     animate-fade-in"
        >
          {text}
          {/* Caret */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                          border-l-4 border-r-4 border-t-4
                          border-l-transparent border-r-transparent border-t-espresso" />
        </div>
      )}
    </span>
  );
}
