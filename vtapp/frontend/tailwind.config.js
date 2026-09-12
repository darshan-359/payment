/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // === QuorumGuard Cream & Brown Palette ===
        cream: {
          DEFAULT: '#F3E9DA',
          warm: '#FBF5EC',
        },
        espresso: '#3B2A20',
        brown: {
          muted: '#7A5C46',
          walnut: '#8C5A3C',
          deep: '#6E4529',
          border: '#D9C6AE',
        },
        // Semantic status colors
        success: '#4C7A4C',   // Low risk / Approved
        warning: '#B58A3A',   // Medium risk / Review
        danger: '#A2432E',    // High risk / Declined
        info: '#4A6E8C',      // Pending / Syncing
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '14px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(59, 42, 32, 0.08), 0 1px 3px rgba(59, 42, 32, 0.06)',
        'card-hover': '0 6px 24px rgba(59, 42, 32, 0.12), 0 2px 6px rgba(59, 42, 32, 0.08)',
      },
    },
  },
  plugins: [],
};
