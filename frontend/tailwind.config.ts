import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: { DEFAULT: '#e63946', dark: '#c1121f' },
        mt: {
          purple: {
            50:  '#F5F3FF',
            100: '#EDE9FE',
            600: '#7C3AED',
            700: '#5B21B6',
            900: '#2D1B69',
          },
          rose: {
            100: '#FFE4E6',
            500: '#F43F5E',
            600: '#E11D48',
          },
        },
      },
      keyframes: {
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'scan-line': {
          '0%':   { top: '8px',  opacity: '1' },
          '50%':  { opacity: '0.6' },
          '100%': { top: 'calc(100% - 8px)', opacity: '1' },
        },
      },
      animation: {
        'slide-up':  'slide-up 0.2s ease-out',
        'fade-in':   'fade-in 0.15s ease-out',
        'scan-line': 'scan-line 2s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
};

export default config;
