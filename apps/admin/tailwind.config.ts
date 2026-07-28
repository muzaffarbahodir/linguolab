import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Manrope — общий шрифт всех приложений LinguoLab. Системный запасным:
      // пока переменный файл грузится, текст рисуется им и не прыгает.
      fontFamily: {
        sans: [
          'Manrope Variable',
          'Manrope',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
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
