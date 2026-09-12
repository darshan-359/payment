// LiquidButton.jsx
// A primary call-to-action button with a subtle liquid/morphing blob hover effect.
// The goo-filter SVG creates the "blob biting into the button" illusion.
// Effect is kept sub-200ms so it doesn't slow down live demos.

import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';

export default function LiquidButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary', // 'primary' | 'danger' | 'success'
  className = '',
  type = 'button',
  loading = false,
}) {
  const [blobPos, setBlobPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const btnRef = useRef(null);

  const variantStyles = {
    primary: {
      btn: 'bg-brown-walnut text-cream border-brown-walnut hover:bg-brown-deep',
      blob: 'bg-brown-deep',
    },
    danger: {
      btn: 'bg-danger text-white border-danger',
      blob: 'bg-red-800',
    },
    success: {
      btn: 'bg-success text-white border-success',
      blob: 'bg-green-800',
    },
  };

  const styles = variantStyles[variant] || variantStyles.primary;

  function handleMouseMove(e) {
    const rect = btnRef.current.getBoundingClientRect();
    setBlobPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  return (
    <>
      {/* Goo SVG filter — hidden, renders once per page use */}
      <svg className="absolute w-0 h-0 overflow-hidden" aria-hidden="true">
        <defs>
          <filter id="goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <button
        ref={btnRef}
        type={type}
        onClick={onClick}
        disabled={disabled || loading}
        aria-busy={loading}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseMove={handleMouseMove}
        className={`
          relative overflow-hidden font-semibold px-6 py-2.5 rounded-xl text-sm
          border transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brown-walnut
          disabled:opacity-50 disabled:cursor-not-allowed
          goo-filter
          ${styles.btn} ${className}
        `}
      >
        {/* Morphing blob that follows cursor */}
        {hovered && !disabled && (
          <motion.span
            className={`absolute w-20 h-20 rounded-full pointer-events-none ${styles.blob} opacity-40 blob-animate`}
            style={{ left: blobPos.x - 40, top: blobPos.y - 40 }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.8, opacity: 0.35 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          />
        )}

        {/* Button label */}
        <span className="relative z-10 flex items-center gap-2">
          {loading && (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          )}
          {children}
        </span>
      </button>
    </>
  );
}
