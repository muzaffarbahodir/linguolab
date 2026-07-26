import { Global, Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { PageViewController } from './page-view.controller';
import { BusinessStatsController } from './business-stats.controller';
import { BusinessStatsService } from './business-stats.service';
import { AnalyticsRefreshService } from './analytics-refresh.service';

/**
 * AnalyticsModule — @Global() чтобы AnalyticsService был доступен
 * во всех модулях без повторного импорта.
 */
@Global()
@Module({
  controllers: [AnalyticsController, PageViewController, BusinessStatsController],
  providers: [AnalyticsService, AnalyticsRefreshService, BusinessStatsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
