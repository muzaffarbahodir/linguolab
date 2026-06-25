/**
 * Sentry SDK инициализация — ДОЛЖЕН импортироваться первым в main.ts
 * до любых других импортов (требование @sentry/nestjs).
 *
 * Если SENTRY_DSN не задан — Sentry отключён (dev без конфига).
 */
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0.0,

  integrations: [
    nodeProfilingIntegration(),
    // Traces every Prisma query with duration — shows slow queries in Sentry performance
    Sentry.prismaIntegration(),
    // Traces outgoing http/https + undici/fetch (R2 uploads, Telegram API calls, Payme)
    Sentry.httpIntegration(),
  ],

  environment: process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.SENTRY_DSN,
});
