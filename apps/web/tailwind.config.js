/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Telegram theme cssvars — заполняются автоматически через WebApp.themeParams
      // Используем как `bg-tg-bg`, `text-tg-text` и т.д.
      colors: {
        // Fallback'и тёмные — приложение брендово-тёмное (vars форсятся в main.tsx).
        // Если CSS-var вдруг не задан, получаем тёмную палитру, не светлую.
        tg: {
          // Привязаны к переменным темы (см. index.css :root / html.light)
          bg: 'var(--bg)',
          'secondary-bg': 'var(--secondary-bg)',
          text: 'var(--text)',
          hint: 'var(--muted)',
          link: 'var(--tg-theme-link-color, #6366F1)',
          button: 'var(--tg-theme-button-color, #6366F1)',
          'button-text': 'var(--tg-theme-button-text-color, #ffffff)',
          destructive: 'var(--tg-theme-destructive-text-color, #ff453a)',
        },
        // Бренд — индиго (тема flowershop). Тема-зависимый через CSS-переменные
        // (каналы RGB), чтобы работали opacity-модификаторы bg-brand/15 и т.д.
        brand: {
          DEFAULT: 'rgb(var(--brand-rgb) / <alpha-value>)',
          50: '#EEF0FE',
          100: '#E0E3FB',
          400: 'rgb(var(--brand-400-rgb) / <alpha-value>)',
          500: 'rgb(var(--brand-rgb) / <alpha-value>)',
          600: '#4F46E5',
          700: '#4338CA',
        },
        // Семантические токены поверхностей/границ/текста (тёмная тема).
        // Юзать вместо повторяющихся rgba(255,255,255,0.0x):
        //   bg-surface  border-hairline  text-muted  text-faint
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        hairline: 'var(--hairline)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        // Семантические статус-цвета (= lib/status.ts, для не-статусных UI)
        ok: '#10B981',
        warn: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      // Мягкая многослойная элевация (глубина тенью, не блюром — дёшево на Android).
      // shadow-e1 малые карты, e2 интерактив/нажатие, e3 поднятые/модалки.
      boxShadow: {
        e1: '0 1px 2px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.10)',
        e2: '0 2px 4px rgba(0,0,0,0.14), 0 8px 24px rgba(0,0,0,0.16)',
        e3: '0 4px 8px rgba(0,0,0,0.18), 0 16px 48px rgba(0,0,0,0.24)',
      },
    },
  },
  plugins: [],
};
