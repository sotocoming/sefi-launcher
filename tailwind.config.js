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
        sefi: {
          bg: '#09090D',
          surface1: '#111118',
          surface2: '#171720',
          glass: 'rgba(18, 16, 28, 0.74)',
          border: 'rgba(255, 255, 255, 0.08)',
          borderHover: 'rgba(196, 112, 255, 0.28)',
          textPrimary: '#F7F4FB',
          textSecondary: '#A8A3B3',
          textMuted: '#6F6A79',
          purple: '#B45CFF',
          purpleLight: '#D18AFF',
          magenta: '#E35CFF',
          green: '#52E38B',
          yellow: '#F5C451',
          red: '#FF647C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Geist', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
