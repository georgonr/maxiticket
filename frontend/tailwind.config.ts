import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#e63946', dark: '#c1121f' },
      },
    },
  },
  plugins: [],
};

export default config;
