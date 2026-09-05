/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        groww: {
          green: '#00D09C',
          'green-dark': '#00B386',
          'green-light': '#E8FAF5',
          blue: '#5367FF',
          'blue-dark': '#4052E6',
          'blue-light': '#EEF2FF',
          charcoal: '#44475B',
          red: '#EB5B3C',
          'red-light': '#FDF2F0',
          amber: '#F59E0B',
          'amber-light': '#FEF3C7',
          bg: '#F8FAFC',
          card: '#FFFFFF',
          border: '#E2E8F0',
          'border-subtle': '#EDF2F7',
          'text-primary': '#44475B',
          'text-secondary': '#6B7280',
          'text-muted': '#9CA3AF',
        },
      },
    },
  },
  plugins: [],
};
