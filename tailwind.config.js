/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Compatibility palette for the existing accent utilities.
        fuchsia: { 100: '#EEE8FF', 200: '#DDD4F5', 300: '#C4B5FD', 400: '#B3A0EA', 500: '#9582C5', 600: '#75639E', 900: '#332640' },
        sefi: {
          bg: '#101116',
          surface1: '#191B23',
          surface2: '#222530',
          glass: 'rgba(18, 16, 28, 0.74)',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(196, 112, 255, 0.28)',
          textPrimary: '#F1F0F5',
          textSecondary: '#B2B4C3',
          textMuted: '#A1A4B5',
          purple: '#C4B5FD',
          purpleLight: '#D18AFF',
          magenta: '#E35CFF',
          green: '#52E38B',
          yellow: '#F5C451',
          red: '#FF647C',
        },
      },
      fontFamily: {
        sans: ['Segoe UI Variable', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
