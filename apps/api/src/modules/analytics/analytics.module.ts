import { Global, Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PageViewController } from './page-view.controller';
import { AnalyticsRefreshService } from './analytics-refresh.service';

/**
 * AnalyticsModule — @Global() чтобы AnalyticsService был доступен
 * во всех модулях без повторного импорта.
 */
@Global()
@Module({
  controllers: [AnalyticsController, PageViewController],
  providers: [AnalyticsService, AnalyticsRefreshService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
