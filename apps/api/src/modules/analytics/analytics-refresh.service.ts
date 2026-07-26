import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

const VIEWS = [
  'mv_daily_event_counts',
  'mv_monthly_revenue',
  'mv_student_activity',
  'mv_funnel_monthly',
  'mv_class_stats',
  'mv_teacher_performance',
] as const;

@Injectable()
export class AnalyticsRefreshService {
  private readonly logger = new Logger(AnalyticsRefreshService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Refresh all materialized views every hour. */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshAll(): Promise<void> {
    for (const view of VIEWS) {
      try {
        await this.prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
        this.logger.debug(`Refreshed ${view}`);
      } catch (err) {
        this.logger.error(`Failed to refresh ${view}: ${String(err)}`);
      }
    }
  }

  /**
   * Держит наготове партицию на два месяца вперёд.
   *
   * Ежедневно, а не первого числа: функция идемпотентна и стоит копейки, тогда
   * как запуск раз в месяц означал, что недоступность API ровно в этот день
   * (деплой, перезапуск, сбой) отодвигает следующую попытку на месяц. Дешевле
   * пробовать каждый день, чем однажды обнаружить события в
   * analytics_events_default.
   */
  @Cron('0 0 * * *')
  async ensureNextPartition(): Promise<void> {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 2, 1);
    const iso = nextMonth.toISOString().slice(0, 10);
    try {
      await this.prisma.$executeRaw`SELECT ensure_analytics_partition(${iso}::date)`;
      this.logger.log(`Ensured analytics partition for ${iso.slice(0, 7)}`);
    } catch (err) {
      this.logger.error(`Failed to ensure partition: ${String(err)}`);
    }
  }
}
