/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#eef4ff',
          100: '#d9e8ff',
          200: '#bcd3ff',
          300: '#8eb4fd',
          400: '#5a89fa',
          500: '#3462f5',
          600: '#2148eb',
          700: '#1937d1',
          800: '#1b30a8',
          900: '#1c2d84',
          950: '#141d51',
        },
        risk: {
          critical: '#dc2626',
          'critical-bg': '#fef2f2',
          'critical-border': '#fca5a5',
          high: '#ea580c',
          'high-bg': '#fff7ed',
          'high-border': '#fdba74',
          medium: '#ca8a04',
          'medium-bg': '#fefce8',
          'medium-border': '#fde047',
          low: '#16a34a',
          'low-bg': '#f0fdf4',
          'low-border': '#86efac',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted:   '#f8fafc',
          border:  '#e2e8f0',
        },
      },
    },
  },
  plugins: [],
}
