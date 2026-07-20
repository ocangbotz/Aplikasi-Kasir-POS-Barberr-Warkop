/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./frontend/index.html', './frontend/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        barber: {
          DEFAULT: '#2563eb',
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a'
        },
        warkop: {
          DEFAULT: '#ea580c',
          50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
          400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
          800: '#9a3412', 900: '#7c2d12'
        },
        gabungan: {
          DEFAULT: '#16a34a',
          50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac',
          400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d'
        }
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(15, 23, 42, 0.12)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.45)'
      },
      backdropBlur: { glass: '16px' }
    }
  },
  plugins: []
};
