// Sentry ПЕРВЫЙ импорт — до всего остального (требование SDK)
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';

import { AppModule } from './app.module';

// BigInt → string при JSON-сериализации. Prisma отдаёт telegram_user_id,
// telegram_chat_id, amount_tiyin как BigInt; JSON.stringify по умолчанию
// бросает "Do not know how to serialize a BigInt" → 500. Патчим глобально.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

/**
 * Bootstrap — точка входа NestJS приложения.
 *
 * CORS:
 *   CORS_ALLOWED_ORIGINS — comma-separated список origins.
 *   Пример: "https://app-linguolab.muzaffarbahodir.uz,https://admin-linguolab.muzaffarbahodir.uz,http://localhost:5173"
 *   credentials: true — нужен для передачи cookies (NextAuth) и Authorization header.
 *
 * ValidationPipe:
 *   whitelist: true — отбрасываем поля не описанные в DTO (защита от лишнего payload).
 *   forbidNonWhitelisted: true — бросаем 400 если лишние поля присутствуют.
 *   transform: true — авто-кастинг типов (string → number где нужно).
 *
 * Global prefix /api/v1:
 *   Исключения: /health и / (без префикса для healthcheck и root info).
 *
 * Trust proxy:
 *   Критично за nginx + Cloudflare: req.ip будет реальный IP, не 127.0.0.1.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const config = app.get(ConfigService);

  // CORS: читаем origins из env, разделитель запятая
  if (config.get('NODE_ENV') === 'production' && !config.get('CORS_ALLOWED_ORIGINS')) {
    throw new Error('CORS_ALLOWED_ORIGINS must be set in production');
  }
  const allowedOriginsRaw = config.get<string>(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://localhost:3001',
  );
  const allowedOrigins = allowedOriginsRaw.split(',').map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true, // для Authorization header + cookies (NextAuth)
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Helmet — HTTP security headers (CSP, HSTS, X-Frame-Options и др.)
  // crossOriginEmbedderPolicy: false — совместимость с Telegram Web App iframe
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
    }),
  );

  // Express trust proxy — для корректного req.ip за nginx + Cloudflare
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.setGlobalPrefix('api/v1', {
    exclude: ['health', '/'], // healthcheck и root — без /api/v1 префикса
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = config.get<number>('PORT', 3000);

  await app.listen(port, '0.0.0.0');
  Logger.log(
    `API listening on port ${port} (NODE_ENV=${process.env.NODE_ENV ?? 'development'})`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  Logger.error('Bootstrap failed', err instanceof Error ? err.stack : String(err), 'Bootstrap');
  process.exit(1);
});
