import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('admin/analytics/events')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * GET /admin/analytics/events/summary?days=30
   * Сводка событий за последние N дней.
   */
  @Get('summary')
  async summary(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    if (days < 1 || days > 365) days = 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const until = new Date();

    const [byType, uniqueUsers, funnel] = await Promise.all([
      this.analytics.countByType(since, until),
      this.analytics.uniqueUsers(since, until),
      this.analytics.funnelStats(since),
    ]);

    return {
      period_days: days,
      since: since.toISOString(),
      unique_users: uniqueUsers,
      by_type: byType,
      funnel,
    };
  }

  /**
   * GET /admin/analytics/events/daily-logins?days=30
   * Ежедневные логины за последние N дней.
   */
  @Get('daily-logins')
  async dailyLogins(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    if (days < 1 || days > 90) days = 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const until = new Date();
    return this.analytics.dailyLogins(since, until);
  }

  /**
   * GET /admin/analytics/events/top-students?days=30&limit=10
   * Топ активных студентов.
   */
  @Get('top-students')
  async topStudents(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    if (days < 1 || days > 365) days = 30;
    if (limit < 1 || limit > 50) limit = 10;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.analytics.topActiveStudents(since, limit);
  }

  // ─── Materialized-view endpoints ─────────────────────────────────────────────

  /**
   * GET /admin/analytics/mv/daily?days=30
   * Дневные счётчики событий из mv_daily_event_counts (быстро).
   */
  @Get('mv/daily')
  async mvDaily(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    if (days < 1 || days > 365) days = 30;
    return this.analytics.mvDailyEventCounts(days);
  }

  /**
   * GET /admin/analytics/mv/revenue?months=6
   * Ежемесячная выручка из mv_monthly_revenue.
   */
  @Get('mv/revenue')
  async mvRevenue(@Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number) {
    if (months < 1 || months > 24) months = 6;
    return this.analytics.mvMonthlyRevenue(months);
  }

  /**
   * GET /admin/analytics/mv/students?limit=20
   * Топ студентов (rolling 30d) из mv_student_activity.
   */
  @Get('mv/students')
  async mvStudents(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    if (limit < 1 || limit > 100) limit = 20;
    return this.analytics.mvTopStudents(limit);
  }

  /**
   * GET /admin/analytics/mv/funnel?months=6
   * Воронка конверсии по месяцам из mv_funnel_monthly.
   */
  @Get('mv/funnel')
  async mvFunnel(@Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number) {
    if (months < 1 || months > 24) months = 6;
    return this.analytics.mvFunnelMonthly(months);
  }

  /**
   * GET /admin/analytics/mv/classes
   * Статистика по классам из mv_class_stats.
   */
  @Get('mv/classes')
  async mvClasses() {
    return this.analytics.mvClassStats();
  }

  /**
   * GET /admin/analytics/mv/teachers
   * Показатели учителей из mv_teacher_performance.
   */
  @Get('mv/teachers')
  async mvTeachers() {
    return this.analytics.mvTeacherPerformance();
  }
}
