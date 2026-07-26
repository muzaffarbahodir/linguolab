import { Injectable } from '@nestjs/common';
import { PaymentStatus, SalaryType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/** Начало месяца в UTC. */
function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * BusinessStatsService — деньги и удержание.
 *
 * Две цифры, которых не хватало для решений: остаются ли студенты и какая
 * группа зарабатывает. Выручка по месяцам и число новых студентов уже были, но
 * по ним нельзя понять ни того, ни другого — растущая выручка при текущих
 * студентах означает, что школа бежит на месте, просто быстрее набирая.
 */
@Injectable()
export class BusinessStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Удержание по когортам: из тех, кто записался в месяц X, сколько ещё учится
   * спустя 1, 2, 3 месяца.
   *
   * Когорта — месяц ПЕРВОЙ записи студента, а не каждой: иначе человек,
   * перешедший из группы в группу, попадал бы в несколько когорт сразу и
   * удержание выглядело бы лучше, чем есть.
   *
   * Пробные записи исключены. Пробный по определению разовый, и считать его
   * уходом значит объявить оттоком каждого, кто просто пришёл посмотреть.
   */
  async retention(months = 6) {
    const since = monthStart(new Date());
    since.setUTCMonth(since.getUTCMonth() - months);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { is_trial: false },
      select: {
        student_id: true,
        status: true,
        enrolled_at: true,
        paid_until: true,
      },
      orderBy: { enrolled_at: 'asc' },
    });

    // Первая непробная запись студента = его когорта.
    const firstSeen = new Map<string, Date>();
    const lastActive = new Map<string, Date>();

    for (const e of enrollments) {
      if (!firstSeen.has(e.student_id)) firstSeen.set(e.student_id, e.enrolled_at);

      // Докуда студент точно был с нами: оплаченный период, а если его нет —
      // дата записи. Активная запись без paid_until считается живой сегодня.
      const until =
        e.status === 'ACTIVE' && !e.paid_until ? new Date() : (e.paid_until ?? e.enrolled_at);
      const prev = lastActive.get(e.student_id);
      if (!prev || until > prev) lastActive.set(e.student_id, until);
    }

    const cohorts = new Map<string, { size: number; alive: number[] }>();

    for (const [studentId, first] of firstSeen) {
      if (first < since) continue;
      const key = monthKey(monthStart(first));
      const c = cohorts.get(key) ?? { size: 0, alive: [0, 0, 0] };
      c.size += 1;

      const until = lastActive.get(studentId)!;
      const livedMonths =
        (until.getUTCFullYear() - first.getUTCFullYear()) * 12 +
        (until.getUTCMonth() - first.getUTCMonth());

      // «Дожил до N-го месяца» — накопительно: доживший до третьего дожил и
      // до первого, иначе кривая удержания не убывает и читается неверно.
      for (let m = 0; m < 3; m++) {
        if (livedMonths >= m + 1) c.alive[m] = (c.alive[m] ?? 0) + 1;
      }
      cohorts.set(key, c);
    }

    return [...cohorts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, c]) => ({
        cohort_month: month,
        students: c.size,
        month_1_pct: pct(c.alive[0] ?? 0, c.size),
        month_2_pct: pct(c.alive[1] ?? 0, c.size),
        month_3_pct: pct(c.alive[2] ?? 0, c.size),
      }));
  }

  /**
   * Рентабельность групп: выручка минус стоимость преподавателя.
   *
   * Считаем только то, что можно отнести к конкретной группе честно:
   *   PER_LESSON    — проведённые занятия × ставку;
   *   REVENUE_SHARE — процент от выручки этой же группы;
   *   FIXED         — оклад к группе не привязан (преподаватель получает его
   *                   независимо от числа групп), поэтому cost = null, а не
   *                   выдуманное «поделим поровну». Прибыль в этом случае тоже
   *                   не показываем: цифра, посчитанная наполовину, хуже её
   *                   отсутствия.
   *
   * Аренда, реклама и администрация сюда не входят — это не себестоимость
   * группы, а расходы школы.
   */
  async classProfitability(since: Date, until: Date) {
    const classes = await this.prisma.class.findMany({
      select: {
        id: true,
        title: true,
        teacher: {
          select: { user_id: true, user: { select: { first_name: true, last_name: true } } },
        },
        _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
        lessons: {
          where: { status: 'COMPLETED', scheduled_at: { gte: since, lt: until } },
          select: { id: true },
        },
        payments: {
          where: { status: PaymentStatus.PAID, paid_at: { gte: since, lt: until } },
          select: { amount_tiyin: true },
        },
      },
    });

    const employees = await this.prisma.employee.findMany({
      where: { is_active: true },
      select: { user_id: true, salary_type: true, rate_uzs: true, rate_percent: true },
    });
    const byUser = new Map(employees.map((e) => [e.user_id, e]));

    return classes
      .map((c) => {
        const revenue = Math.round(
          c.payments.reduce((s, p) => s + Number(p.amount_tiyin), 0) / 100,
        );
        const emp = byUser.get(c.teacher.user_id);

        let cost: number | null = null;
        if (emp?.salary_type === SalaryType.PER_LESSON) {
          cost = c.lessons.length * emp.rate_uzs;
        } else if (emp?.salary_type === SalaryType.REVENUE_SHARE) {
          cost = Math.round((revenue * emp.rate_percent) / 100);
        }

        return {
          class_id: c.id,
          class_title: c.title,
          teacher: `${c.teacher.user.first_name} ${c.teacher.user.last_name ?? ''}`.trim(),
          active_students: c._count.enrollments,
          lessons_held: c.lessons.length,
          revenue_uzs: revenue,
          teacher_cost_uzs: cost,
          profit_uzs: cost === null ? null : revenue - cost,
          /** Почему прибыль не посчитана — чтобы null не выглядел ошибкой. */
          cost_note:
            emp === undefined
              ? 'Преподаватель не заведён как сотрудник'
              : emp.salary_type === SalaryType.FIXED
                ? 'Оклад не привязан к группе'
                : null,
        };
      })
      .sort((a, b) => (a.profit_uzs ?? Infinity) - (b.profit_uzs ?? Infinity));
  }
}
