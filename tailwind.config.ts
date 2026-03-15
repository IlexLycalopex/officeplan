import type { Config } from 'tailwindcss'
import path from 'path'

// Use __dirname so content paths resolve correctly regardless of what directory
// Vite / PostCSS is launched from. Convert to forward slashes for Tailwind's
// glob engine (required on Windows).
const root = __dirname.replace(/\\/g, '/')

export default {
  darkMode: ['class'],
  content: [
    `${root}/index.html`,
    `${root}/src/**/*.{ts,tsx}`,
  ],
  theme: {
    extend: {
      colors: {
        // CSS variable-backed tokens (used by @apply in index.css and shadcn/ui primitives)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
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
