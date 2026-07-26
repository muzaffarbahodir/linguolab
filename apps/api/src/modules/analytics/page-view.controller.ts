import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { AnalyticsService } from './analytics.service';

/** Сколько путей принимаем за один запрос. */
const MAX_BATCH = 20;

/** Ограничение длины пути — защита от мусора в колонке. */
const MAX_PATH_LEN = 200;

export class PageViewDto {
  /** Пути экранов, по одному на просмотр. Порядок сохраняем. */
  paths!: string[];
}

/**
 * Приём просмотров экранов из мини-аппа.
 *
 * Отдельный контроллер, а не метод в AnalyticsController: тот целиком закрыт
 * ролью ADMIN, а писать сюда должен любой авторизованный студент.
 *
 * Пакетом, а не по одному событию: просмотры — самое частое, что происходит в
 * приложении, и запрос на каждый переход между экранами превратился бы в
 * постоянный фон нагрузки на API и в мусор в таблице.
 */
@Controller('analytics')
export class PageViewController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * POST /analytics/page-views
   * Тело: { paths: ["/catalog", "/class/abc"] }
   */
  @Post('page-views')
  @HttpCode(204)
  // Лимит с запасом к обычному поведению: пакет уходит раз в несколько секунд,
  // но при быстром листании экранов их может накопиться несколько подряд.
  @Throttle({ short: { limit: 5, ttl: 10_000 }, medium: { limit: 60, ttl: 60_000 } })
  async track(@Body() dto: PageViewDto, @CurrentUser() user: RequestUser): Promise<void> {
    const paths = Array.isArray(dto?.paths) ? dto.paths : [];

    for (const raw of paths.slice(0, MAX_BATCH)) {
      if (typeof raw !== 'string') continue;
      const path = this.sanitize(raw);
      if (!path) continue;

      void this.analytics.track('page_view', {
        userId: user.id,
        userRole: user.role,
        entityType: 'screen',
        properties: { path },
      });
    }
  }

  /**
   * Оставляем только путь.
   *
   * Query-строку и хеш отбрасываем целиком: там оказываются идентификаторы и
   * параметры поиска, то есть данные о конкретном человеке, которые в
   * обезличенной статистике посещений не нужны и хранить их незачем.
   */
  private sanitize(raw: string): string | null {
    const path = raw.split('?')[0]!.split('#')[0]!.trim();
    if (!path.startsWith('/')) return null;
    return path.slice(0, MAX_PATH_LEN);
  }
}
