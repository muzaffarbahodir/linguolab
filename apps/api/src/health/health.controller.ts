import { Controller, Get } from '@nestjs/common';

import { Public } from '../modules/auth/decorators/public.decorator';

/**
 * HealthController — простой liveness probe.
 *
 * GET /health — без префикса (см. main.ts setGlobalPrefix exclude).
 * Используется:
 * - Docker healthcheck
 * - Cloudflare uptime check
 * - nginx upstream проверка
 *
 * @Public() — эти эндпоинты без JWT (иначе healthcheck упадёт с 401).
 */
@Public()
@Controller()
export class HealthController {
  @Get('health')
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'linguolab-api',
      version: process.env.npm_package_version ?? '0.0.0',
    };
  }

  @Get('/')
  root() {
    return { name: 'linguolab-api', docs: '/api/v1' };
  }
}
