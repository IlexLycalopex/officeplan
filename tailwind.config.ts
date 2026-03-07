import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Desk status design tokens (consistent across the whole app)
        'desk-available': '#22c55e',    // green-500
        'desk-booked': '#3b82f6',       // blue-500
        'desk-pending': '#f59e0b',      // amber-500
        'desk-restricted': '#6b7280',   // gray-500
        'desk-unavailable': '#ef4444',  // red-500
        'desk-maintenance': '#f97316',  // orange-500
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config
