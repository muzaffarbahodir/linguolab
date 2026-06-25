import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default withSentryConfig(nextConfig, {
  // Sentry organization + project (из настроек проекта в sentry.io)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Не блокировать build если Sentry недоступен (нет DSN в CI)
  silent: !process.env.SENTRY_DSN,

  // Не загружать source maps без явного DSN (dev)
  widenClientFileUpload: !!process.env.SENTRY_DSN,

  // Отключаем лишние логи
  disableLogger: true,
});
