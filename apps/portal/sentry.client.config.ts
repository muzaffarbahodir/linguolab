/**
 * Sentry client-side config (runs in browser).
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 *
 * Enabled only when NEXT_PUBLIC_SENTRY_DSN is set.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Трассировка производительности в browser
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Воспроизведение сессий при ошибках (1% всего, 100% при ошибке)
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  environment: process.env.NODE_ENV ?? 'development',

  // Фильтр шумных ошибок
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'window.Telegram',
  ],
});
