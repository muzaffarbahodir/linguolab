import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AnalyticsEventType =
  | 'page_view'
  | 'enroll'
  | 'payment_paid'
  | 'homework_submit'
  | 'lesson_attend'
  | 'trial_request'
  | 'placement_complete'
  | 'login'
  | 'certificate_issued';

/**
 * AnalyticsService — fire-and-forget event tracking.
 *
 * Все вставки асинхронны и не блокируют основной флоу.
 * Ошибки логируются, но не бросаются наружу.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Записывает одно событие в analytics_events.
   * Fire-and-forget — не нужно await вне этого метода.
   */
  async track(
    eventType: AnalyticsEventType,
    opts: {
      userId?: string;
      userRole?: string;
      entityId?: string;
      entityType?: string;
      properties?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          event_type: eventType,
          user_id: opts.userId ?? null,
          user_role: opts.userRole ?? null,
          entity_id: opts.entityId ?? null,
          entity_type: opts.entityType ?? null,
          properties: opts.properties ? (opts.properties as object) : undefined,
        },
      });
    } catch {
      // Не ломаем основной флоу если аналитика упала
    }
  }

  // ─── Aggregation queries ────────────────────────────────────────────────────

  /** Количество событий по типу за период */
  async countByType(since: Date, until: Date): Promise<{ event_type: string; count: number }[]> {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['event_type'],
      where: { created_at: { gte: since, lte: until } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    return rows.map((r) => ({ event_type: r.event_type, count: r._count.id }));
  }

  /** DAU/WAU/MAU — уникальные пользователи за период */
  async uniqueUsers(since: Date, until: Date): Promise<number> {
    const result = await this.prisma.analyticsEvent.findMany({
      where: { created_at: { gte: since, lte: until }, user_id: { not: null } },
      select: { user_id: true },
      distinct: ['user_id'],
    });
    return result.length;
  }

  /** Новые регистрации по дням (event_type = 'login' первый раз) */
  async dailyLogins(since: Date, until: Date): Promise<{ date: string; count: number }[]> {
    const rows = await this.prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
        COUNT(*) AS count
      FROM "analytics_events"
      WHERE event_type = 'login'
        AND created_at >= ${since}
        AND created_at <= ${until}
      GROUP BY date_trunc('day', created_at)
      ORDER BY date ASC
    `;
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  /** Воронка: trial_request → enroll → payment_paid */
  async funnelStats(since: Date): Promise<{
    trial_requests: number;
    enrollments: number;
    payments: number;
    conversion_trial_to_enroll: number;
    conversion_enroll_to_paid: number;
  }> {
    const [trials, enrolls, payments] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { event_type: 'trial_request', created_at: { gte: since } },
      }),
      this.prisma.analyticsEvent.count({
        where: { event_type: 'enroll', created_at: { gte: since } },
      }),
      this.prisma.analyticsEvent.count({
        where: { event_type: 'payment_paid', created_at: { gte: since } },
      }),
    ]);

    return {
      trial_requests: trials,
      enrollments: enrolls,
      payments,
      conversion_trial_to_enroll: trials > 0 ? Math.round((enrolls / trials) * 100) : 0,
      conversion_enroll_to_paid: enrolls > 0 ? Math.round((payments / enrolls) * 100) : 0,
    };
  }

  /** Топ-10 активных студентов за период */
  async topActiveStudents(
    since: Date,
    limit = 10,
  ): Promise<{ user_id: string; event_count: number }[]> {
    const rows = await this.prisma.analyticsEvent.groupBy({
      by: ['user_id'],
      where: {
        created_at: { gte: since },
        user_id: { not: null },
        user_role: 'STUDENT',
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });
    return rows
      .filter((r) => r.user_id != null)
      .map((r) => ({ user_id: r.user_id!, event_count: r._count.id }));
  }

  // ─── Materialized view queries ──────────────────────────────────────────────

  /** mv_daily_event_counts: events per day per type (last N days) */
  async mvDailyEventCounts(
    days: number,
  ): Promise<{ day: string; event_type: string; cnt: number }[]> {
    const rows = await this.prisma.$queryRaw<{ day: Date; event_type: string; cnt: number }[]>`
      SELECT day, event_type, cnt
      FROM mv_daily_event_counts
      WHERE day >= (CURRENT_DATE - (${days}::int || ' days')::interval)::date
      ORDER BY day DESC, cnt DESC
    `;
    return rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      event_type: r.event_type,
      cnt: Number(r.cnt),
    }));
  }

  /** mv_monthly_revenue: revenue per month */
  async mvMonthlyRevenue(
    months: number,
  ): Promise<{ month: string; revenue_uzs: number; payments_count: number }[]> {
    const rows = await this.prisma.$queryRaw<
      { month: Date; revenue_uzs: bigint; payments_count: number }[]
    >`
      SELECT month, revenue_uzs, payments_count
      FROM mv_monthly_revenue
      WHERE month >= date_trunc('month', NOW() - (${months}::int || ' months')::interval)
      ORDER BY month DESC
    `;
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      revenue_uzs: Number(r.revenue_uzs),
      payments_count: Number(r.payments_count),
    }));
  }

  /** mv_student_activity: top active students (rolling 30d) */
  async mvTopStudents(limit: number): Promise<
    {
      user_id: string;
      lessons_attended: number;
      hw_submitted: number;
      active_days: number;
      last_active_at: string;
    }[]
  > {
    const rows = await this.prisma.$queryRaw<
      {
        user_id: string;
        lessons_attended: number;
        hw_submitted: number;
        active_days: number;
        last_active_at: Date;
      }[]
    >`
      SELECT user_id, lessons_attended, hw_submitted, active_days, last_active_at
      FROM mv_student_activity
      ORDER BY lessons_attended DESC, hw_submitted DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      user_id: r.user_id,
      lessons_attended: Number(r.lessons_attended),
      hw_submitted: Number(r.hw_submitted),
      active_days: Number(r.active_days),
      last_active_at: r.last_active_at.toISOString(),
    }));
  }

  /** mv_funnel_monthly: conversion funnel per month */
  async mvFunnelMonthly(
    months: number,
  ): Promise<{ month: string; trials: number; enrollments: number; payments: number }[]> {
    const rows = await this.prisma.$queryRaw<
      { month: Date; trials: number; enrollments: number; payments: number }[]
    >`
      SELECT month, trials, enrollments, payments
      FROM mv_funnel_monthly
      WHERE month >= date_trunc('month', NOW() - (${months}::int || ' months')::interval)
      ORDER BY month DESC
    `;
    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      trials: Number(r.trials),
      enrollments: Number(r.enrollments),
      payments: Number(r.payments),
    }));
  }

  /** mv_class_stats: enrollment + revenue per class */
  async mvClassStats(): Promise<
    {
      class_id: string;
      title: string;
      level: string;
      enrolled_active: number;
      enrolled_total: number;
      lessons_completed: number;
      monthly_revenue_uzs: number;
      avg_attendance_pct: number;
    }[]
  > {
    const rows = await this.prisma.$queryRaw<
      {
        class_id: string;
        title: string;
        level: string;
        enrolled_active: number;
        enrolled_total: number;
        lessons_completed: number;
        monthly_revenue_uzs: bigint;
        avg_attendance_pct: number;
      }[]
    >`
      SELECT class_id, title, level, enrolled_active, enrolled_total,
             lessons_completed, monthly_revenue_uzs, avg_attendance_pct
      FROM mv_class_stats
      ORDER BY enrolled_active DESC
    `;
    return rows.map((r) => ({
      class_id: r.class_id,
      title: r.title,
      level: r.level,
      enrolled_active: Number(r.enrolled_active),
      enrolled_total: Number(r.enrolled_total),
      lessons_completed: Number(r.lessons_completed),
      monthly_revenue_uzs: Number(r.monthly_revenue_uzs),
      avg_attendance_pct: Number(r.avg_attendance_pct),
    }));
  }

  /** mv_teacher_performance: teacher KPIs */
  async mvTeacherPerformance(): Promise<
    {
      user_id: string;
      first_name: string;
      last_name: string | null;
      classes_count: number;
      lessons_conducted: number;
      students_total: number;
      avg_attendance_pct: number;
    }[]
  > {
    const rows = await this.prisma.$queryRaw<
      {
        user_id: string;
        first_name: string;
        last_name: string | null;
        classes_count: number;
        lessons_conducted: number;
        students_total: number;
        avg_attendance_pct: number;
      }[]
    >`
      SELECT user_id, first_name, last_name, classes_count,
             lessons_conducted, students_total, avg_attendance_pct
      FROM mv_teacher_performance
      ORDER BY lessons_conducted DESC
    `;
    return rows.map((r) => ({
      user_id: r.user_id,
      first_name: r.first_name,
      last_name: r.last_name,
      classes_count: Number(r.classes_count),
      lessons_conducted: Number(r.lessons_conducted),
      students_total: Number(r.students_total),
      avg_attendance_pct: Number(r.avg_attendance_pct),
    }));
  }
}
