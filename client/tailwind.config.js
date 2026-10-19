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
          50: '#FFF1F3',          // Design handoff: Pale-red icon / hover background
          100: '#FFE4E6',
          200: '#FECDD3',         // Subtle red border
          500: '#F43F5E',
          600: '#D91542',         // Design handoff: Primary UI accent
          700: '#BE123C',
          800: '#9F1239',
          900: '#881337',
          accent: '#D91542',      // Primary red accent
          pale: '#FFF1F3',        // Pale red container
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
          input: '#0F172A',
          raised: '#1E293B',
          border: '#334155',
          borderSubtle: '#1E293B',
          redSurface: '#2A1422',
        },
        darkText: {
          primary: '#F8FAFC',
          body: '#CBD5E1',
          muted: '#94A3B8',
          accent: '#FB7185',
          redTint: '#FDA4AF',
        },
        slate: {
          750: '#1E293B',
          755: '#1E293B',
          850: '#0F172A',
        },
        semantic: {
          positive: '#16A34A',
          negative: '#DC2626',
          warning: '#D97706',
          ai: '#7C3AED',
        }
      },
      borderRadius: {
        'control': '8px',         // Standard control radius
        'menu': '8px',            // Dropdown menu radius
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
