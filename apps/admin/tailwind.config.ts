import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6C5CE7',
          50: '#F0EEFC',
          100: '#E1DDF9',
          500: '#6C5CE7',
          600: '#5849D1',
          700: '#4438A3',
        },
      },
    },
  },
  plugins: [],
};

export default config;
