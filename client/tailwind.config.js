/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          500: '#F43F5E',
          600: '#E11D48',
          700: '#BE123C',
          800: '#9F1239',
          900: '#881337',
        },
        surface: {
          canvas: '#F8FAFC',      // Main page background
          card: '#FFFFFF',        // White surface containers
          cardHover: '#F8FAFC',   // Hover background
          subtle: '#F1F5F9',      // Subtle neutral background
          border: '#E2E8F0',      // Standard subtle border
          borderLight: '#CBD5E1', // Focus/hover border
        },
        darkSurface: {
          canvas: '#0B0F19',
          card: '#111827',
          cardHover: '#1F2937',
          subtle: '#1E293B',
          border: '#1F2937',
          borderLight: '#374151',
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
