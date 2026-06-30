import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CEFR, Role } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';

const CLASSES_CACHE_TTL = 300; // 5 минут

/** Поля учителя которые отдаём публично */
const teacherSelect = {
  id: true,
  bio: true,
  photo_url: true,
  user: {
    select: {
      first_name: true,
      last_name: true,
      avatar_url: true,
    },
  },
};

/** Поля класса для списка */
const classListSelect = {
  id: true,
  title: true,
  level: true,
  price_uzs: true,
  max_students: true,
  description: true,
  is_active: true,
  schedule_days: true,
  schedule_time: true,
  schedule_duration: true,
  created_at: true,
  language: {
    select: {
      id: true,
      code: true,
      name_ru: true,
      flag_emoji: true,
      color: true,
    },
  },
  teacher: {
    select: teacherSelect,
  },
  _count: {
    select: {
      enrollments: {
        where: { status: { in: ['ACTIVE' as const, 'PENDING' as const] } },
      },
    },
  },
};

@Injectable()
export class ClassesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  /** GET /classes — список активных классов с фильтром */
  async findAll(languageId?: string, level?: CEFR) {
    // Кэш только для запросов без фильтров (публичный каталог)
    const cacheKey = `cache:classes:${languageId ?? 'all'}:${level ?? 'all'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as unknown[];

    const classes = await this.prisma.class.findMany({
      where: {
        is_active: true,
        ...(languageId ? { language_id: languageId } : {}),
        ...(level ? { level } : {}),
      },
      select: classListSelect,
      orderBy: { created_at: 'asc' },
    });

    const result = classes.map((c) => ({
      ...c,
      enrolled_count: c._count.enrollments,
      spots_left: c.max_students - c._count.enrollments,
      _count: undefined,
    }));

    void this.redis.setex(cacheKey, CLASSES_CACHE_TTL, JSON.stringify(result));
    return result;
  }

  /**
   * GET /classes/my — классы учителя (или все для MANAGER/ADMIN).
   * Возвращает с количеством студентов и последним уроком.
   */
  async getMyClasses(userId: string, role: Role) {
    if (role === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId } });
      if (!teacher) return [];

      const classes = await this.prisma.class.findMany({
        where: { teacher_id: teacher.id },
        select: {
          ...classListSelect,
          lessons: {
            orderBy: { scheduled_at: 'desc' },
            take: 1,
            select: { id: true, scheduled_at: true, status: true },
          },
        },
        orderBy: { created_at: 'asc' },
      });

      return classes.map((c) => ({
        ...c,
        enrolled_count: c._count.enrollments,
        spots_left: c.max_students - c._count.enrollments,
        latest_lesson: c.lessons[0] ?? null,
        _count: undefined,
        lessons: undefined,
      }));
    }

    // MANAGER/ADMIN — все классы
    return this.findAll();
  }

  /**
   * GET /classes/:classId/students — активные студенты класса.
   * Используется в форме посещаемости.
   */
  async getClassStudents(classId: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { class_id: classId, status: 'ACTIVE' },
      include: {
        student: {
          select: { id: true, first_name: true, last_name: true, avatar_url: true },
        },
      },
      orderBy: { enrolled_at: 'asc' },
    });

    return enrollments.map((e) => e.student);
  }

  /**
   * GET /classes/:classId/student-stats — посещаемость и ДЗ по каждому студенту класса.
   */
  async getClassStudentStats(classId: string) {
    // 5 параллельных запросов вместо 2*N (groupBy заменяет N count() на студента)
    const [totalLessons, totalHomework, enrollments, attendanceGroups, hwGroups] =
      await Promise.all([
        this.prisma.lesson.count({ where: { class_id: classId, status: 'COMPLETED' } }),
        this.prisma.homework.count({ where: { class_id: classId } }),
        this.prisma.enrollment.findMany({
          where: { class_id: classId, status: 'ACTIVE' },
          include: {
            student: {
              select: { id: true, first_name: true, last_name: true, avatar_url: true },
            },
          },
          orderBy: { enrolled_at: 'asc' },
        }),
        this.prisma.lessonAttendance.groupBy({
          by: ['student_id'],
          where: {
            lesson: { class_id: classId },
            status: { in: ['PRESENT', 'LATE'] },
          },
          _count: { _all: true },
        }),
        this.prisma.homeworkSubmission.groupBy({
          by: ['student_id'],
          where: { homework: { class_id: classId } },
          _count: { _all: true },
        }),
      ]);

    const attendanceMap = new Map(attendanceGroups.map((a) => [a.student_id, a._count._all]));
    const hwMap = new Map(hwGroups.map((h) => [h.student_id, h._count._all]));

    const stats = enrollments.map((e) => {
      const presentCount = attendanceMap.get(e.student_id) ?? 0;
      const hwSubmitted = hwMap.get(e.student_id) ?? 0;
      const attendancePct =
        totalLessons > 0 ? Math.round((presentCount / totalLessons) * 100) : null;

      return {
        student: e.student,
        attendance: { present: presentCount, total: totalLessons, pct: attendancePct },
        homework: { submitted: hwSubmitted, total: totalHomework },
      };
    });

    return stats.sort((a, b) => (b.attendance.pct ?? 0) - (a.attendance.pct ?? 0));
  }

  /** GET /classes/:id — детали класса */
  async findOne(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      select: classListSelect,
    });

    if (!cls) throw new NotFoundException('Class not found');

    return {
      ...cls,
      enrolled_count: cls._count.enrollments,
      spots_left: cls.max_students - cls._count.enrollments,
      _count: undefined,
    };
  }

  /**
   * GET /classes/:id/setup — состояние «готовности» класса к работе.
   * Учитель видит что осталось заполнить (расписание, дата старта, ссылка).
   * teacherUserId передаётся для учителя → проверка владения классом.
   */
  async getClassSetup(classId: string, teacherUserId?: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        title: true,
        schedule_days: true,
        schedule_time: true,
        schedule_duration: true,
        starts_at: true,
        ends_at: true,
        meeting_url: true,
        teacher: { select: { user_id: true } },
        _count: { select: { lessons: true } },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');
    if (teacherUserId && cls.teacher.user_id !== teacherUserId) {
      throw new ForbiddenException('Not your class');
    }

    return {
      id: cls.id,
      title: cls.title,
      schedule_days: cls.schedule_days,
      schedule_time: cls.schedule_time,
      schedule_duration: cls.schedule_duration,
      starts_at: cls.starts_at,
      ends_at: cls.ends_at,
      meeting_url: cls.meeting_url,
      lessons_count: cls._count.lessons,
    };
  }

  /**
   * PATCH /classes/:id/schedule — расписание занятий.
   * Менеджер/админ — любой класс; учитель — только свой (teacherUserId).
   */
  async setSchedule(
    classId: string,
    days: string[],
    time: string,
    duration: number,
    startsAt?: string | null,
    teacherUserId?: string,
  ) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, teacher: { select: { user_id: true } } },
    });
    if (!cls) throw new NotFoundException('Class not found');
    if (teacherUserId && cls.teacher.user_id !== teacherUserId) {
      throw new ForbiddenException('Not your class');
    }

    // Дата начала курса — от неё генерируются уроки. undefined → не трогаем.
    let starts: Date | null | undefined;
    if (startsAt === null) starts = null;
    else if (typeof startsAt === 'string' && startsAt) {
      const d = new Date(startsAt);
      if (isNaN(d.getTime())) throw new BadRequestException('Invalid start date');
      starts = d;
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: {
        schedule_days: days,
        schedule_time: time,
        schedule_duration: duration,
        ...(starts !== undefined ? { starts_at: starts } : {}),
      },
      select: {
        id: true,
        title: true,
        schedule_days: true,
        schedule_time: true,
        schedule_duration: true,
        starts_at: true,
      },
    });
  }

  /**
   * PATCH /classes/:id/group — менеджер привязывает Telegram-группу к классу.
   * chatId передаётся как строка (BigInt не сериализуется в JSON).
   */
  async setTelegramGroup(classId: string, chatIdStr: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    return this.prisma.class.update({
      where: { id: classId },
      data: { telegram_chat_id: BigInt(chatIdStr) },
      select: { id: true, title: true, telegram_chat_id: true },
    });
  }

  /**
   * PATCH /classes/:id/meeting — учитель (свой класс) или менеджер задаёт Zoom-ссылку.
   * Авто-отправляется студенту после оплаты.
   */
  async setMeetingUrl(classId: string, meetingUrl: string, teacherUserId?: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, teacher: { select: { user_id: true } } },
    });
    if (!cls) throw new NotFoundException('Class not found');
    if (teacherUserId && cls.teacher.user_id !== teacherUserId) {
      throw new ForbiddenException('Not your class');
    }

    return this.prisma.class.update({
      where: { id: classId },
      data: { meeting_url: meetingUrl?.trim() || null },
      select: { id: true, title: true, meeting_url: true },
    });
  }

  /** POST /classes/:id/enroll — записаться в класс */
  async enroll(classId: string, studentId: string) {
    // Проверяем класс
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        is_active: true,
        max_students: true,
        _count: {
          select: {
            enrollments: {
              where: { status: { in: ['ACTIVE', 'PENDING'] } },
            },
          },
        },
      },
    });

    if (!cls || !cls.is_active) throw new NotFoundException('Class not found');

    // Проверяем лимит
    if (cls._count.enrollments >= cls.max_students) {
      throw new BadRequestException('Class is full');
    }

    // Проверяем: уже записан?
    const existing = await this.prisma.enrollment.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
    });

    if (existing) {
      throw new ConflictException('Already enrolled in this class');
    }

    const enrollment = await this.prisma.enrollment.create({
      data: {
        student_id: studentId,
        class_id: classId,
        status: 'PENDING',
      },
      select: {
        id: true,
        status: true,
        enrolled_at: true,
      },
    });

    // Уведомляем студента в Telegram (fire-and-forget, ошибки не пробрасываем)
    void this.sendEnrollmentNotification(classId, studentId);
    // Уведомляем персонал о новой заявке на запись
    void this.notifyStaffOfEnrollment(classId, studentId, enrollment.id);

    return enrollment;
  }

  /** Уведомление менеджерам/админам о новой заявке на запись (fire-and-forget). */
  private async notifyStaffOfEnrollment(classId: string, studentId: string, enrollmentId: string) {
    try {
      const [stu, cls] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: studentId },
          select: { first_name: true, last_name: true },
        }),
        this.prisma.class.findUnique({ where: { id: classId }, select: { title: true } }),
      ]);
      if (!stu || !cls) return;
      const who = `${stu.first_name}${stu.last_name ? ' ' + stu.last_name : ''}`;
      await this.notifications.notifyStaffNewRequest(
        '📝 Новая заявка на запись',
        `${who} — ${cls.title}`,
        `enroll:${enrollmentId}`,
      );
    } catch {
      // не ломаем основной флоу
    }
  }

  /**
   * GET /classes/:classId/students/:studentId/overview
   * Учитель смотрит детальную статистику студента.
   * Проверяем что учитель ведёт этот класс и студент в нём записан.
   */
  async getStudentOverview(teacherUserId: string, classId: string, studentId: string) {
    // Проверяем доступ: учитель ведёт этот класс
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, teacher: { user_id: teacherUserId } },
      select: { id: true, level: true, title: true },
    });
    if (!cls) throw new NotFoundException('Class not found or access denied');

    // Студент записан в этот класс
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
    });
    if (!enrollment) throw new NotFoundException('Student not enrolled in this class');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      student,
      attendanceStats,
      monthAttendance,
      upcomingLesson,
      lastHomework,
      hwStats,
      placementTest,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: studentId },
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

      this.prisma.lessonAttendance.groupBy({
        by: ['status'],
        where: { student_id: studentId, lesson: { class_id: classId } },
        _count: { id: true },
      }),

      this.prisma.lessonAttendance.findMany({
        where: {
          student_id: studentId,
          lesson: { class_id: classId, scheduled_at: { gte: monthStart } },
        },
        select: { status: true },
      }),

      this.prisma.lesson.findFirst({
        where: {
          class_id: classId,
          status: 'SCHEDULED',
          scheduled_at: { gte: now },
        },
        select: {
          id: true,
          title: true,
          scheduled_at: true,
          duration_min: true,
          class: {
            select: { title: true, language: { select: { flag_emoji: true, name_ru: true } } },
          },
        },
        orderBy: { scheduled_at: 'asc' },
      }),

      this.prisma.homework.findFirst({
        where: { class_id: classId },
        include: {
          submissions: {
            where: { student_id: studentId },
            select: { status: true, grade: true },
            take: 1,
          },
        },
        orderBy: { created_at: 'desc' },
      }),

      this.prisma.homeworkSubmission.aggregate({
        where: { student_id: studentId, homework: { class_id: classId } },
        _count: { id: true },
        _avg: { grade: true },
      }),

      this.prisma.placementTest.findFirst({
        where: { user_id: studentId, status: 'COMPLETED' },
        select: { level_assigned: true, score: true },
        orderBy: { started_at: 'desc' },
      }),
    ]);

    if (!student) throw new NotFoundException('Student not found');

    // Статистика посещаемости
    const totalAttend = attendanceStats.reduce((s, a) => s + a._count.id, 0);
    const presentCount = attendanceStats
      .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
      .reduce((s, a) => s + a._count.id, 0);
    const attendancePct = totalAttend > 0 ? Math.round((presentCount / totalAttend) * 100) : null;

    const monthTotal = monthAttendance.length;
    const monthPresent = monthAttendance.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE',
    ).length;
    const monthPct = monthTotal > 0 ? Math.round((monthPresent / monthTotal) * 100) : null;

    // Рейтинг в этом классе
    const classEnrollments = await this.prisma.enrollment.findMany({
      where: { class_id: classId, status: 'ACTIVE' },
      select: { student_id: true },
    });
    const studentIds = classEnrollments.map((e) => e.student_id);
    const classAttendance = await this.prisma.lessonAttendance.groupBy({
      by: ['student_id', 'status'],
      where: { student_id: { in: studentIds }, lesson: { class_id: classId } },
      _count: { id: true },
    });
    // Группируем записи по student_id за один проход — O(n) вместо O(n²)
    const attendanceByStudent = new Map<string, typeof classAttendance>();
    for (const a of classAttendance) {
      const arr = attendanceByStudent.get(a.student_id) ?? [];
      arr.push(a);
      attendanceByStudent.set(a.student_id, arr);
    }
    const studentPcts = studentIds.map((sid) => {
      const records = attendanceByStudent.get(sid) ?? [];
      const tot = records.reduce((s, a) => s + a._count.id, 0);
      const pres = records
        .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
        .reduce((s, a) => s + a._count.id, 0);
      return { student_id: sid, pct: tot > 0 ? Math.round((pres / tot) * 100) : 0 };
    });
    studentPcts.sort((a, b) => b.pct - a.pct);
    const classRank = studentPcts.findIndex((s) => s.student_id === studentId) + 1;
    const myPct = studentPcts.find((s) => s.student_id === studentId)?.pct ?? 0;

    // Рейтинг по уровню (среди всех студентов в классах того же CEFR уровня)
    const levelRanking = await this.computeLevelRanking(studentId, cls.level);

    // ДЗ статистика
    const hwTotal = await this.prisma.homework.count({ where: { class_id: classId } });
    const hwSubmitted = hwStats._count.id;
    const avgGrade = hwStats._avg.grade ? Math.round(hwStats._avg.grade) : null;

    // Оценка учителя от этого студента
    const myRating = await this.prisma.teacherRating.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
      select: { rating: true, comment: true },
    });

    return {
      child: {
        id: student.id,
        first_name: student.first_name,
        last_name: student.last_name,
        avatar_url: student.avatar_url,
        active_classes: student.enrollments.map((e) => {
          const teacherRatings = e.class.teacher.ratings;
          const avgTeacherRating =
            teacherRatings.length > 0
              ? teacherRatings.reduce((s, r) => s + r.rating, 0) / teacherRatings.length
              : null;
          return {
            ...e.class,
            teacher: {
              id: e.class.teacher.id,
              bio: e.class.teacher.bio,
              user: e.class.teacher.user,
              avg_rating: avgTeacherRating ? Math.round(avgTeacherRating * 10) / 10 : null,
              ratings_count: teacherRatings.length,
            },
          };
        }),
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
      ranking:
        classRank > 0
          ? {
              class_id: classId,
              class_title: cls.title,
              rank: classRank,
              total: studentIds.length,
              student_pct: myPct,
            }
          : null,
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
      my_rating: myRating,
    };
  }

  /**
   * Вычисляет ранг студента среди всех студентов в классах того же CEFR уровня.
   */
  private async computeLevelRanking(
    studentId: string,
    level: string,
  ): Promise<{ rank: number; total: number; pct: number } | null> {
    // Все классы этого уровня с активными студентами
    const levelEnrollments = await this.prisma.enrollment.findMany({
      where: { status: 'ACTIVE', class: { level: level as never } },
      select: { student_id: true },
    });

    const allStudentIds = [...new Set(levelEnrollments.map((e) => e.student_id))];
    if (allStudentIds.length === 0) return null;

    // Посещаемость всех студентов в классах данного уровня
    const attendance = await this.prisma.lessonAttendance.groupBy({
      by: ['student_id', 'status'],
      where: { student_id: { in: allStudentIds }, lesson: { class: { level: level as never } } },
      _count: { id: true },
    });

    const pcts = allStudentIds.map((sid) => {
      const records = attendance.filter((a) => a.student_id === sid);
      const tot = records.reduce((s, a) => s + a._count.id, 0);
      const pres = records
        .filter((a) => a.status === 'PRESENT' || a.status === 'LATE')
        .reduce((s, a) => s + a._count.id, 0);
      return { student_id: sid, pct: tot > 0 ? Math.round((pres / tot) * 100) : 0 };
    });

    pcts.sort((a, b) => b.pct - a.pct);
    const rank = pcts.findIndex((s) => s.student_id === studentId) + 1;
    const myPct = pcts.find((s) => s.student_id === studentId)?.pct ?? 0;

    return rank > 0 ? { rank, total: allStudentIds.length, pct: myPct } : null;
  }

  /**
   * POST /classes/:classId/rate  — студент оценивает учителя класса.
   * upsert: 1 оценка на (student, class).
   */
  async rateTeacher(studentId: string, classId: string, rating: number, comment?: string) {
    if (rating < 1 || rating > 5) throw new BadRequestException('Rating must be 1-5');

    // Студент должен быть активно записан в класс
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
    });
    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new NotFoundException('You are not enrolled in this class');
    }

    // Оценку можно ставить только после проведённого урока в классе.
    const conducted = await this.prisma.lesson.count({
      where: { class_id: classId, status: 'COMPLETED' },
    });
    if (conducted === 0) {
      throw new ForbiddenException('LESSON_NOT_CONDUCTED');
    }

    // Получаем teacher_id класса
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: { teacher_id: true },
    });
    if (!cls) throw new NotFoundException('Class not found');

    const result = await this.prisma.teacherRating.upsert({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
      create: {
        student_id: studentId,
        teacher_id: cls.teacher_id,
        class_id: classId,
        rating,
        comment: comment ?? null,
      },
      update: { rating, comment: comment ?? null },
      select: { id: true, rating: true, comment: true },
    });

    return result;
  }

  /**
   * GET /classes/:classId/teacher/rating — публичный рейтинг учителя класса.
   */
  async getTeacherRating(classId: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        teacher: {
          select: {
            id: true,
            user: { select: { first_name: true, last_name: true, avatar_url: true } },
            ratings: {
              select: { rating: true, comment: true, created_at: true },
              orderBy: { created_at: 'desc' },
              take: 20,
            },
          },
        },
      },
    });
    if (!cls) throw new NotFoundException('Class not found');

    const { ratings } = cls.teacher;
    const avg =
      ratings.length > 0
        ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
        : null;

    return {
      teacher: cls.teacher,
      avg_rating: avg,
      total_ratings: ratings.length,
      ratings,
    };
  }

  /**
   * GET /classes/:classId/my-rating — оценка текущего студента для данного класса.
   */
  async getMyRating(studentId: string, classId: string) {
    return this.prisma.teacherRating.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
      select: { rating: true, comment: true },
    });
  }

  /**
   * GET /classes/:classId/students/:studentId/attendance
   * Учитель смотрит посещаемость студента в своём классе.
   */
  async getStudentAttendanceForTeacher(teacherUserId: string, classId: string, studentId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, teacher: { user_id: teacherUserId } },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('Class not found or access denied');

    return this.prisma.lessonAttendance.findMany({
      where: { student_id: studentId, lesson: { class_id: classId } },
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
   * GET /classes/:classId/students/:studentId/homework
   * Учитель смотрит домашние задания студента в своём классе.
   */
  async getStudentHomeworkForTeacher(teacherUserId: string, classId: string, studentId: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, teacher: { user_id: teacherUserId } },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('Class not found or access denied');

    return this.prisma.homework.findMany({
      where: { class_id: classId },
      include: {
        class: { select: { title: true } },
        submissions: {
          where: { student_id: studentId },
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

  // ─── Waitlist ─────────────────────────────────────────────────────────────

  /**
   * POST /classes/:classId/waitlist — студент встаёт в очередь на полный класс.
   */
  async joinWaitlist(classId: string, studentId: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        is_active: true,
        max_students: true,
        _count: { select: { enrollments: { where: { status: { in: ['ACTIVE', 'PENDING'] } } } } },
      },
    });
    if (!cls || !cls.is_active) throw new NotFoundException('Class not found');

    // Уже записан (любой статус)?
    const existing = await this.prisma.enrollment.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
    });
    if (existing) {
      throw new ConflictException('Already enrolled or on waitlist');
    }

    // Если мест ещё есть — просто записываем обычно
    if (cls._count.enrollments < cls.max_students) {
      throw new BadRequestException('Class has spots available — use /enroll instead');
    }

    const enrollment = await this.prisma.enrollment.create({
      data: { student_id: studentId, class_id: classId, status: 'WAITLIST' },
      select: { id: true, status: true, enrolled_at: true },
    });

    return enrollment;
  }

  /**
   * DELETE /classes/:classId/waitlist — студент покидает очередь.
   */
  async leaveWaitlist(classId: string, studentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
    });
    if (!enrollment || enrollment.status !== 'WAITLIST') {
      throw new NotFoundException('Not on waitlist');
    }

    await this.prisma.enrollment.delete({
      where: { student_id_class_id: { student_id: studentId, class_id: classId } },
    });

    return { success: true };
  }

  /** Собирает данные для уведомления и отправляет через TelegramService */
  private async sendEnrollmentNotification(classId: string, studentId: string) {
    try {
      const [student, classInfo] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: studentId },
          select: { telegram_user_id: true },
        }),
        this.prisma.class.findUnique({
          where: { id: classId },
          select: {
            title: true,
            language: { select: { flag_emoji: true } },
            teacher: {
              select: {
                user: { select: { first_name: true, last_name: true } },
              },
            },
          },
        }),
      ]);

      if (!student || !classInfo) return;

      const teacherName =
        classInfo.teacher.user.first_name +
        (classInfo.teacher.user.last_name ? ' ' + classInfo.teacher.user.last_name : '');

      await this.telegram.notifyEnrolled(
        student.telegram_user_id,
        classInfo.title,
        teacherName,
        classInfo.language.flag_emoji,
      );
    } catch {
      // Не ломаем основной флоу если уведомление не отправилось
    }
  }
}
