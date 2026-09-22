/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        surface: {
          canvas: '#F8FAFC',      // Main page background
          card: '#FFFFFF',        // White surface containers
          cardHover: '#F8FAFC',   // Hover background
          subtle: '#F1F5F9',      // Subtle neutral background
          border: '#E2E8F0',      // Standard subtle border
          borderLight: '#CBD5E1', // Focus/hover border
        },
        semantic: {
          positive: '#16A34A',
          negative: '#DC2626',
          warning: '#D97706',
          ai: '#7C3AED',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
