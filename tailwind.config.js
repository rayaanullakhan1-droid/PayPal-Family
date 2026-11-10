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
        fintech: {
          primary: '#0070E0',
          navy: '#12304A',
          deep: '#003087',
          bg: '#F5F7FA',
          card: '#FFFFFF',
          text: '#172B4D',
          muted: '#68778D',
          border: '#E5EAF0',
          success: '#16803C',
          warning: '#B7791F',
          error: '#D92D20',
          accent: '#EBF4FE',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Arial', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        'card': '14px',
      },
      boxShadow: {
        'card': '0 2px 8px -2px rgba(18, 48, 74, 0.06), 0 1px 3px 0 rgba(18, 48, 74, 0.04)',
        'card-hover': '0 8px 24px -4px rgba(18, 48, 74, 0.1), 0 2px 6px -1px rgba(18, 48, 74, 0.06)',
        'elevated': '0 12px 32px -4px rgba(18, 48, 74, 0.12)',
      }
    },
  },
  plugins: [],
}

