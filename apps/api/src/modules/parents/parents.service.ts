import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * ParentsService — управление связью родитель-ребёнок.
 *
 * Флоу привязки:
 *  1. Родитель (PARENT role) вызывает createInvite() → получает 6-значный код
 *     действующий 24 часа.
 *  2. Родитель передаёт код ребёнку (вне системы — голосом/SMS/Telegram).
 *  3. Ребёнок (STUDENT role) вызывает acceptInvite(code) → создаётся
 *     ParentChildLink.
 *
 * Ограничения:
 *  - 1 студент может быть привязан к ≤ 5 родителям.
 *  - 1 родитель может привязать ≤ 10 детей.
 *  - Нельзя привязать самого себя.
 *  - Нельзя повторно привязать уже привязанного ребёнка.
 */
@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Инвайт ──────────────────────────────────────────────────────────────

  /**
   * POST /parents/invite
   * Создаёт invite-код. Роль: PARENT.
   * Возвращает { code, expires_at }.
   */
  async createInvite(parentId: string) {
    // Проверяем лимит детей
    const childrenCount = await this.prisma.parentChildLink.count({
      where: { parent_id: parentId },
    });
    if (childrenCount >= 10) {
      throw new BadRequestException('Parent can have at most 10 children linked');
    }

    // Инвалидируем все предыдущие неиспользованные инвайты этого родителя
    await this.prisma.parentLinkInvite.updateMany({
      where: { parent_id: parentId, used_at: null, expires_at: { gt: new Date() } },
      data: { expires_at: new Date() }, // немедленно истекают
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const invite = await this.prisma.parentLinkInvite.create({
      data: {
        parent_id: parentId,
        expires_at: expiresAt,
      },
      select: { code: true, expires_at: true },
    });

    return { code: invite.code, expires_at: invite.expires_at };
  }

  /**
   * POST /parents/invite/:code/accept
   * Ребёнок принимает инвайт. Роль: STUDENT.
   * Создаёт ParentChildLink.
   */
  async acceptInvite(code: string, childId: string) {
    const invite = await this.prisma.parentLinkInvite.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    });

    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.used_at) throw new BadRequestException('Invite already used');
    if (invite.expires_at < new Date()) throw new BadRequestException('Invite expired');
    if (invite.parent_id === childId) throw new BadRequestException('Cannot link yourself');

    // Проверяем лимит родителей у ребёнка
    const parentsCount = await this.prisma.parentChildLink.count({
      where: { child_id: childId },
    });
    if (parentsCount >= 5) {
      throw new BadRequestException('Student can have at most 5 parents linked');
    }

    // Проверяем дубль
    const exists = await this.prisma.parentChildLink.findUnique({
      where: { parent_id_child_id: { parent_id: invite.parent_id, child_id: childId } },
    });
    if (exists) throw new ConflictException('Already linked to this parent');

    // Транзакция: пометить invite использованным + создать link
    const [link] = await this.prisma.$transaction([
      this.prisma.parentChildLink.create({
        data: { parent_id: invite.parent_id, child_id: childId },
      }),
      this.prisma.parentLinkInvite.update({
        where: { code },
        data: { used_at: new Date(), child_id: childId },
      }),
    ]);

    return { ok: true, link_id: link.id };
  }

  // ─── Дети ─────────────────────────────────────────────────────────────────

  /**
   * GET /parents/children
   * Список детей родителя с базовой информацией. Роль: PARENT.
   */
  async getChildren(parentId: string) {
    const links = await this.prisma.parentChildLink.findMany({
      where: { parent_id: parentId },
      include: {
        child: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            avatar_url: true,
            enrollments: {
              where: { status: 'ACTIVE' },
              select: {
                class: {
                  select: { id: true, title: true, language: { select: { flag_emoji: true } } },
                },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    return links.map(({ id: linkId, created_at, child }) => ({
      link_id: linkId,
      linked_at: created_at,
      child: {
        id: child.id,
        first_name: child.first_name,
        last_name: child.last_name,
        avatar_url: child.avatar_url,
        active_classes: child.enrollments.map((e) => e.class),
      },
    }));
  }

  /**
   * DELETE /parents/children/:childId
   * Отвязать ребёнка. Роль: PARENT.
   */
  async unlinkChild(parentId: string, childId: string) {
    const link = await this.prisma.parentChildLink.findUnique({
      where: { parent_id_child_id: { parent_id: parentId, child_id: childId } },
    });
    if (!link) throw new NotFoundException('Link not found');

    await this.prisma.parentChildLink.delete({ where: { id: link.id } });
    return { ok: true };
  }

  // ─── Read-only APIs для родителей ────────────────────────────────────────

  /**
   * GET /parents/children/:childId/schedule
   * Ближайший урок ребёнка. Роль: PARENT (проверяем доступ).
   */
  async getChildSchedule(parentId: string, childId: string) {
    await this.assertAccess(parentId, childId);

    return this.prisma.enrollment.findMany({
      where: { student_id: childId, status: 'ACTIVE' },
      select: {
        class: {
          select: {
            id: true,
            title: true,
            schedule_days: true,
            schedule_time: true,
            schedule_duration: true,
            language: { select: { name_ru: true, flag_emoji: true } },
            teacher: {
              select: { user: { select: { first_name: true, last_name: true } } },
            },
          },
        },
      },
    });
  }

  /**
   * GET /parents/children/:childId/homework
   * Последние 20 ДЗ ребёнка. Роль: PARENT.
   */
  async getChildHomework(parentId: string, childId: string) {
    await this.assertAccess(parentId, childId);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { student_id: childId, status: 'ACTIVE' },
      select: { class_id: true },
    });
    const classIds = enrollments.map((e) => e.class_id);
    if (!classIds.length) return [];

    return this.prisma.homework.findMany({
      where: { class_id: { in: classIds } },
      include: {
        class: { select: { title: true } },
        submissions: {
          where: { student_id: childId },
          select: {
            status: true,
            grade: true,
            feedback: true,
            submitted_at: true,
            graded_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
  }

  /**
   * GET /parents/children/:childId/attendance
   * Последние 30 записей посещаемости ребёнка. Роль: PARENT.
   */
  async getChildAttendance(parentId: string, childId: string) {
    await this.assertAccess(parentId, childId);

    return this.prisma.lessonAttendance.findMany({
      where: { student_id: childId },
      include: {
        lesson: {
          select: {
            scheduled_at: true,
            title: true,
            class: { select: { title: true, language: { select: { flag_emoji: true } } } },
          },
        },
      },
      orderBy: { lesson: { scheduled_at: 'desc' } },
      take: 30,
    });
  }

  /**
   * GET /parents/children/:childId/progress
   * Достижения + статистика ребёнка. Роль: PARENT.
   */
  async getChildProgress(parentId: string, childId: string) {
    await this.assertAccess(parentId, childId);

    const [achievements, submissionsStats, attendanceStats] = await Promise.all([
      this.prisma.userAchievement.findMany({
        where: { user_id: childId },
        include: { achievement: { select: { title_ru: true, icon: true } } },
        orderBy: { unlocked_at: 'desc' },
        take: 10,
      }),
      this.prisma.homeworkSubmission.aggregate({
        where: { student_id: childId, status: 'GRADED' },
        _avg: { grade: true },
        _count: { id: true },
      }),
      this.prisma.lessonAttendance.groupBy({
        by: ['status'],
        where: { student_id: childId },
        _count: { id: true },
      }),
    ]);

    return {
      achievements,
      homework: {
        graded_count: submissionsStats._count.id,
        avg_grade: submissionsStats._avg.grade,
      },
      attendance: Object.fromEntries(attendanceStats.map((a) => [a.status, a._count.id])),
    };
  }

  /**
   * GET /parents/children/:childId/overview
   * Сводная карточка ребёнка для дашборда родителя.
   */
  async getChildOverview(parentId: string, childId: string) {
    await this.assertAccess(parentId, childId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      child,
      attendanceStats,
      monthAttendance,
      upcomingLesson,
      lastHomework,
      hwStats,
      placementTest,
    ] = await Promise.all([
      // Базовая инфо ребёнка + классы
      this.prisma.user.findUnique({
        where: { id: childId },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          avatar_url: true,
          enrollments: {
            where: { status: 'ACTIVE' },
            select: {
              class: {
                select: {
                  id: true,
                  title: true,
                  level: true,
                  schedule_days: true,
                  schedule_time: true,
                  schedule_duration: true,
                  language: { select: { name_ru: true, flag_emoji: true, color: true } },
                  teacher: {
                    select: {
                      id: true,
                      bio: true,
                      user: { select: { first_name: true, last_name: true, avatar_url: true } },
                      ratings: { select: { rating: true }, take: 100 },
                    },
                  },
                },
              },
            },
          },
        },
      }),

      // Статистика посещений всего
      this.prisma.lessonAttendance.groupBy({
        by: ['status'],
        where: { student_id: childId },
        _count: { id: true },
      }),

      // Посещения за текущий месяц
      this.prisma.lessonAttendance.findMany({
        where: {
          student_id: childId,
          lesson: { scheduled_at: { gte: monthStart } },
        },
        select: { status: true },
      }),

      // Ближайший урок
      this.prisma.lesson.findFirst({
        where: {
          class: {
            enrollments: { some: { student_id: childId, status: 'ACTIVE' } },
          },
          status: 'SCHEDULED',
          scheduled_at: { gte: now },
        },
        include: {
          class: {
            select: {
              title: true,
              language: { select: { flag_emoji: true, name_ru: true } },
            },
          },
        },
        orderBy: { scheduled_at: 'asc' },
      }),

      // Последнее ДЗ
      this.prisma.homework.findFirst({
        where: {
          class: {
            enrollments: { some: { student_id: childId, status: 'ACTIVE' } },
          },
        },
        include: {
          submissions: {
            where: { student_id: childId },
            select: { status: true, grade: true },
            take: 1,
          },
        },
        orderBy: { created_at: 'desc' },
      }),

      // Статистика ДЗ (всего / сдано / средняя оценка)
      this.prisma.homeworkSubmission.aggregate({
        where: { student_id: childId },
        _count: { id: true },
        _avg: { grade: true },
      }),

      // Уровень из теста размещения
      this.prisma.placementTest.findFirst({
        where: { user_id: childId, status: 'COMPLETED' },
        select: { level_assigned: true, score: true },
        orderBy: { started_at: 'desc' },
      }),
    ]);

    if (!child) throw new NotFoundException('Child not found');

    // Считаем % посещаемости (всего)
    const totalAttend = attendanceStats.reduce((s, a) => s + a._count.id, 0);
    const presentCount = attendanceStats
      .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
      .reduce((s, a) => s + a._count.id, 0);
    const attendancePct = totalAttend > 0 ? Math.round((presentCount / totalAttend) * 100) : null;

    // % посещаемости за месяц
    const monthTotal = monthAttendance.length;
    const monthPresent = monthAttendance.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE',
    ).length;
    const monthPct = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : null;

    // ── Рейтинг в классе ──────────────────────────────────────────────────
    // Для каждого класса ребёнка считаем ранг по % посещаемости
    const classRankings: {
      class_id: string;
      class_title: string;
      rank: number;
      total: number;
      student_pct: number;
    }[] = [];

    for (const enrollment of child.enrollments) {
      const cls = enrollment.class;
      // Все студенты класса
      const classEnrollments = await this.prisma.enrollment.findMany({
        where: { class_id: cls.id, status: 'ACTIVE' },
        select: { student_id: true },
      });

      const studentIds = classEnrollments.map((e) => e.student_id);

      // Посещаемость всех студентов в этом классе
      const classAttendance = await this.prisma.lessonAttendance.groupBy({
        by: ['student_id', 'status'],
        where: { student_id: { in: studentIds } },
        _count: { id: true },
      });

      // Считаем % для каждого студента
      const studentPcts: { student_id: string; pct: number }[] = studentIds.map((sid) => {
        const records = classAttendance.filter((a) => a.student_id === sid);
        const total = records.reduce((s, a) => s + a._count.id, 0);
        const present = records
          .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
          .reduce((s, a) => s + a._count.id, 0);
        return { student_id: sid, pct: total > 0 ? Math.round((present / total) * 100) : 0 };
      });

      // Сортируем по убыванию %
      studentPcts.sort((a, b) => b.pct - a.pct);
      const rank = studentPcts.findIndex((s) => s.student_id === childId) + 1;
      const myPct = studentPcts.find((s) => s.student_id === childId)?.pct ?? 0;

      if (rank > 0) {
        classRankings.push({
          class_id: cls.id,
          class_title: cls.title,
          rank,
          total: studentIds.length,
          student_pct: myPct,
        });
      }
    }

    // Лучший ранг среди всех классов
    const bestRank = classRankings.sort((a, b) => a.rank - b.rank)[0] ?? null;

    // Рейтинг по уровню CEFR (среди всех студентов в классах того же уровня)
    const childLevel = child.enrollments[0]?.class.level ?? null;
    let levelRanking: { rank: number; total: number; pct: number } | null = null;
    if (childLevel) {
      const levelEnrollments = await this.prisma.enrollment.findMany({
        where: { status: 'ACTIVE', class: { level: childLevel } },
        select: { student_id: true },
      });
      const allIds = [...new Set(levelEnrollments.map((e) => e.student_id))];
      if (allIds.length > 1) {
        const lvlAttendance = await this.prisma.lessonAttendance.groupBy({
          by: ['student_id', 'status'],
          where: { student_id: { in: allIds }, lesson: { class: { level: childLevel } } },
          _count: { id: true },
        });
        const lvlPcts = allIds.map((sid) => {
          const recs = lvlAttendance.filter((a) => a.student_id === sid);
          const tot = recs.reduce((s, a) => s + a._count.id, 0);
          const pres = recs
            .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
            .reduce((s, a) => s + a._count.id, 0);
          return { student_id: sid, pct: tot > 0 ? Math.round((pres / tot) * 100) : 0 };
        });
        lvlPcts.sort((a, b) => b.pct - a.pct);
        const lvlRank = lvlPcts.findIndex((s) => s.student_id === childId) + 1;
        const myLvlPct = lvlPcts.find((s) => s.student_id === childId)?.pct ?? 0;
        if (lvlRank > 0) levelRanking = { rank: lvlRank, total: allIds.length, pct: myLvlPct };
      }
    }

    // Статистика ДЗ
    const hwTotal = await this.prisma.homework.count({
      where: {
        class: { enrollments: { some: { student_id: childId, status: 'ACTIVE' } } },
      },
    });
    const hwSubmitted = hwStats._count.id;
    const avgGrade = hwStats._avg.grade ? Math.round(hwStats._avg.grade) : null;

    // Учителя с рейтингами
    const activeClassesWithTeacher = child.enrollments.map((e) => {
      const teacherRatings = e.class.teacher.ratings;
      const avgTeacherRating =
        teacherRatings.length > 0
          ? teacherRatings.reduce((s, r) => s + r.rating, 0) / teacherRatings.length
          : null;
      return {
        id: e.class.id,
        title: e.class.title,
        level: e.class.level,
        schedule_days: e.class.schedule_days,
        schedule_time: e.class.schedule_time,
        schedule_duration: e.class.schedule_duration,
        language: e.class.language,
        teacher: {
          id: e.class.teacher.id,
          bio: e.class.teacher.bio,
          user: e.class.teacher.user,
          avg_rating: avgTeacherRating ? Math.round(avgTeacherRating * 10) / 10 : null,
          ratings_count: teacherRatings.length,
        },
      };
    });

    return {
      child: {
        id: child.id,
        first_name: child.first_name,
        last_name: child.last_name,
        avatar_url: child.avatar_url,
        active_classes: activeClassesWithTeacher,
      },
      stats: {
        attendance_pct: attendancePct,
        month_attendance_pct: monthPct,
        month_lessons_total: monthTotal,
        month_lessons_present: monthPresent,
        total_lessons: totalAttend,
        avg_grade: avgGrade,
        hw_total: hwTotal,
        hw_submitted: hwSubmitted,
      },
      ranking: bestRank,
      level_ranking: levelRanking,
      level: placementTest
        ? { level: placementTest.level_assigned, score: placementTest.score }
        : null,
      upcoming_lesson: upcomingLesson
        ? {
            id: upcomingLesson.id,
            title: upcomingLesson.title,
            scheduled_at: upcomingLesson.scheduled_at,
            duration_min: upcomingLesson.duration_min,
            class_title: upcomingLesson.class.title,
            language: upcomingLesson.class.language,
          }
        : null,
      last_homework: lastHomework
        ? {
            id: lastHomework.id,
            title: lastHomework.title,
            due_date: lastHomework.due_date,
            submission: lastHomework.submissions[0] ?? null,
          }
        : null,
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  /** Проверяет что parentId действительно является родителем childId */
  private async assertAccess(parentId: string, childId: string): Promise<void> {
    const link = await this.prisma.parentChildLink.findUnique({
      where: { parent_id_child_id: { parent_id: parentId, child_id: childId } },
    });
    if (!link) throw new ForbiddenException('No access to this child');
  }
}
