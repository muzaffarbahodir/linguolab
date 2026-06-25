import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Карта день недели → номер (JS getDay() формат) */
const DAY_TO_JS: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

const DAY_LABEL_RU: Record<string, string> = {
  MON: 'Пн',
  TUE: 'Вт',
  WED: 'Ср',
  THU: 'Чт',
  FRI: 'Пт',
  SAT: 'Сб',
  SUN: 'Вс',
};

/**
 * Вычисляет дату следующего занятия по расписанию.
 * schedule_time — в формате "HH:MM" (UTC+5, Ташкент).
 * Возвращает ISO-строку или null если расписание не задано.
 */
function getNextSession(days: string[], time: string, durationMinutes: number): string | null {
  if (!days.length || !time) return null;

  // Текущее время в UTC+5
  const nowUtc = new Date();
  const nowTashkent = new Date(nowUtc.getTime() + 5 * 60 * 60 * 1000);

  const [hStr, mStr] = time.split(':');
  const lessonHour = parseInt(hStr ?? '0', 10);
  const lessonMinute = parseInt(mStr ?? '0', 10);

  // Перебираем следующие 8 дней
  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(nowTashkent);
    candidate.setDate(nowTashkent.getDate() + i);
    candidate.setHours(lessonHour, lessonMinute, 0, 0);

    const jsDay = candidate.getDay();
    const dayKey = Object.keys(DAY_TO_JS).find((k) => DAY_TO_JS[k] === jsDay);

    if (dayKey && days.includes(dayKey) && candidate > nowTashkent) {
      // Конвертируем обратно в UTC
      const utcTime = new Date(candidate.getTime() - 5 * 60 * 60 * 1000);
      return utcTime.toISOString();
    }
  }

  return null;
}

@Injectable()
export class LessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * GET /lessons/upcoming — ближайший урок студента.
   * Берёт ACTIVE записи студента, находит класс с расписанием,
   * вычисляет ближайшую дату занятия.
   */
  async getUpcoming(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { student_id: studentId, status: 'ACTIVE' },
      select: {
        class: {
          select: {
            id: true,
            title: true,
            schedule_days: true,
            schedule_time: true,
            schedule_duration: true,
            language: {
              select: { id: true, name_ru: true, flag_emoji: true, color: true },
            },
            teacher: {
              select: { user: { select: { first_name: true, last_name: true } } },
            },
          },
        },
      },
    });

    // Собираем возможные ближайшие уроки
    const upcoming = enrollments
      .map(({ class: cls }) => {
        const next = getNextSession(
          cls.schedule_days,
          cls.schedule_time ?? '',
          cls.schedule_duration ?? 60,
        );
        if (!next) return null;
        return {
          id: cls.id,
          language: cls.language,
          teacher: {
            name: `${cls.teacher.user.first_name}${cls.teacher.user.last_name ? ' ' + cls.teacher.user.last_name : ''}`,
          },
          class_title: cls.title,
          scheduled_at: next,
          duration_minutes: cls.schedule_duration ?? 60,
          schedule_days: cls.schedule_days,
          schedule_days_ru: cls.schedule_days.map((d) => DAY_LABEL_RU[d] ?? d).join(', '),
          schedule_time: cls.schedule_time,
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(a!.scheduled_at).getTime() - new Date(b!.scheduled_at).getTime());

    return upcoming[0] ?? null;
  }

  /** Форматирует расписание в читаемую строку: "Пн, Ср, Пт • 10:00 • 90 мин" */
  static formatSchedule(days: string[], time: string | null, duration: number | null): string {
    const daysStr = days.map((d) => DAY_LABEL_RU[d] ?? d).join(', ');
    const parts = [daysStr, time, duration ? `${duration} мин` : null].filter(Boolean);
    return parts.join(' • ');
  }

  /**
   * GET /lessons/upcoming-list — список ближайших N уроков студента из БД.
   * Возвращает реальные Lesson-записи (не вычисляет по расписанию).
   */
  async getUpcomingList(studentId: string, limit = 10) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { student_id: studentId, status: 'ACTIVE' },
      select: { class_id: true },
    });
    const classIds = enrollments.map((e) => e.class_id);
    if (!classIds.length) return [];

    const lessons = await this.prisma.lesson.findMany({
      where: {
        class_id: { in: classIds },
        status: 'SCHEDULED',
        scheduled_at: { gte: new Date() },
      },
      include: {
        class: {
          select: {
            id: true,
            title: true,
            language: { select: { name_ru: true, flag_emoji: true, color: true } },
            teacher: {
              select: {
                user: { select: { first_name: true, last_name: true } },
              },
            },
          },
        },
      },
      orderBy: { scheduled_at: 'asc' },
      take: limit,
    });

    return lessons.map((l) => ({
      id: l.id,
      title: l.title,
      scheduled_at: l.scheduled_at,
      duration_min: l.duration_min,
      status: l.status,
      class: {
        id: l.class.id,
        title: l.class.title,
        language: l.class.language,
        teacher_name: `${l.class.teacher.user.first_name}${l.class.teacher.user.last_name ? ' ' + l.class.teacher.user.last_name : ''}`,
      },
    }));
  }

  /**
   * GET /lessons/history — прошедшие уроки студента.
   */
  async getHistory(studentId: string, limit = 20) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { student_id: studentId, status: 'ACTIVE' },
      select: { class_id: true },
    });

    const classIds = enrollments.map((e) => e.class_id);
    if (!classIds.length) return [];

    return this.prisma.lesson.findMany({
      where: {
        class_id: { in: classIds },
        status: 'COMPLETED',
        scheduled_at: { lt: new Date() },
      },
      include: {
        class: {
          select: {
            title: true,
            language: { select: { name_ru: true, flag_emoji: true } },
          },
        },
        attendances: {
          where: { student_id: studentId },
          select: { status: true },
        },
      },
      orderBy: { scheduled_at: 'desc' },
      take: limit,
    });
  }

  /**
   * GET /lessons/:id — детали урока.
   */
  async getOne(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        class: {
          select: {
            title: true,
            level: true,
            language: { select: { name_ru: true, flag_emoji: true } },
            teacher: {
              select: { user: { select: { first_name: true, last_name: true } } },
            },
          },
        },
        attendances: {
          include: { student: { select: { id: true, first_name: true, last_name: true } } },
        },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  // ─── Lesson CRUD ────────────────────────────────────────────────────────────

  /**
   * POST /lessons — создать занятие.
   * Только TEACHER/MANAGER/ADMIN.
   * Teacher может создавать только для своих классов.
   */
  async createLesson(
    userId: string,
    userRole: Role,
    dto: {
      classId: string;
      title?: string;
      scheduledAt: string;
      durationMin?: number;
      notes?: string;
    },
  ) {
    // Проверяем существование класса
    const cls = await this.prisma.class.findUnique({
      where: { id: dto.classId },
      include: { teacher: true },
    });
    if (!cls) throw new NotFoundException('Class not found');

    // Teacher — только свои классы
    if (userRole === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId } });
      if (!teacher || teacher.id !== cls.teacher_id) {
        throw new ForbiddenException('Not your class');
      }
    }

    const lesson = await this.prisma.lesson.create({
      data: {
        class_id: dto.classId,
        title: dto.title,
        scheduled_at: new Date(dto.scheduledAt),
        duration_min: dto.durationMin ?? 60,
        notes: dto.notes,
      },
    });

    // Планируем напоминание за 1ч до урока (fire-and-forget)
    void this.notifications.scheduleLessonReminder(lesson.id, dto.classId, lesson.scheduled_at);

    return lesson;
  }

  /**
   * GET /lessons/class/:classId — все уроки класса.
   */
  async getClassLessons(classId: string) {
    return this.prisma.lesson.findMany({
      where: { class_id: classId },
      orderBy: { scheduled_at: 'asc' },
      include: {
        _count: { select: { attendances: true } },
      },
    });
  }

  /**
   * POST /lessons/:id/attendance/bulk — массово отметить посещаемость.
   * attendances: [{ studentId, status, note? }]
   */
  async bulkAttendance(
    lessonId: string,
    userId: string,
    userRole: Role,
    attendances: Array<{
      studentId: string;
      status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
      note?: string;
    }>,
  ) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { class: { include: { teacher: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    // Teacher guard
    if (userRole === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId } });
      if (!teacher || teacher.id !== lesson.class.teacher_id) {
        throw new ForbiddenException('Not your class');
      }
    }

    // Upsert каждый attendance
    const results = await Promise.all(
      attendances.map((a) =>
        this.prisma.lessonAttendance.upsert({
          where: { lesson_id_student_id: { lesson_id: lessonId, student_id: a.studentId } },
          create: { lesson_id: lessonId, student_id: a.studentId, status: a.status, note: a.note },
          update: { status: a.status, note: a.note },
        }),
      ),
    );

    // Помечаем урок как COMPLETED если ещё SCHEDULED
    if (lesson.status === 'SCHEDULED') {
      await this.prisma.lesson.update({ where: { id: lessonId }, data: { status: 'COMPLETED' } });
    }

    // Уведомляем родителей об отсутствующих студентах (fire-and-forget)
    const absentStudents = attendances.filter((a) => a.status === 'ABSENT');
    if (absentStudents.length > 0) {
      const studentIds = absentStudents.map((a) => a.studentId);
      const students = await this.prisma.user.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, first_name: true, last_name: true },
      });

      for (const student of students) {
        const childName = `${student.first_name}${student.last_name ? ' ' + student.last_name : ''}`;
        void this.notifications.notifyParentsOfAbsent(
          student.id,
          childName,
          lesson.class.title,
          lesson.scheduled_at,
        );
      }
    }

    return { ok: true, updated: results.length };
  }

  /**
   * POST /lessons/class/:classId/generate — генерация уроков по расписанию класса.
   *
   * Создаёт уроки на N недель вперёд на основе schedule_days + schedule_time.
   * Не создаёт дубли (upsert по точному timestamp).
   * Расписание: UTC+5 (Ташкент).
   */
  async generateLessons(
    classId: string,
    userId: string,
    userRole: Role,
    weeks = 4,
  ): Promise<{ created: number; skipped: number }> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { teacher: true },
    });
    if (!cls) throw new NotFoundException('Class not found');

    // Teacher может генерировать только для своих классов
    if (userRole === Role.TEACHER) {
      const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId } });
      if (!teacher || teacher.id !== cls.teacher_id) {
        throw new ForbiddenException('Not your class');
      }
    }

    if (!cls.schedule_days.length || !cls.schedule_time) {
      throw new BadRequestException(
        'У класса не задано расписание. Попросите менеджера настроить дни и время.',
      );
    }

    const [hStr, mStr] = cls.schedule_time.split(':');
    const lessonHour = parseInt(hStr ?? '0', 10);
    const lessonMinute = parseInt(mStr ?? '0', 10);
    const duration = cls.schedule_duration ?? 60;

    const DAY_TO_JS: Record<string, number> = {
      SUN: 0,
      MON: 1,
      TUE: 2,
      WED: 3,
      THU: 4,
      FRI: 5,
      SAT: 6,
    };
    const daysJs = cls.schedule_days
      .map((d) => DAY_TO_JS[d])
      .filter((d): d is number => d !== undefined);

    const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5
    const nowUtc = new Date();
    const nowTz = new Date(nowUtc.getTime() + TZ_OFFSET_MS);
    const y = nowTz.getUTCFullYear();
    const mo = nowTz.getUTCMonth();
    const d = nowTz.getUTCDate();

    const candidateDates: Date[] = [];
    const totalDays = weeks * 7;

    for (let i = 0; i < totalDays; i++) {
      // Кандидат в Ташкентском времени (UTC+5 пространство)
      const candidateTz = new Date(Date.UTC(y, mo, d + i, lessonHour, lessonMinute, 0, 0));
      if (!daysJs.includes(candidateTz.getUTCDay())) continue;

      // Конвертируем в UTC для хранения в БД
      const lessonUtc = new Date(candidateTz.getTime() - TZ_OFFSET_MS);
      if (lessonUtc <= nowUtc) continue; // пропускаем прошедшие

      candidateDates.push(lessonUtc);
    }

    if (!candidateDates.length) return { created: 0, skipped: 0 };

    // Находим уже существующие уроки в этом диапазоне
    const existing = await this.prisma.lesson.findMany({
      where: {
        class_id: classId,
        scheduled_at: {
          gte: candidateDates[0],
          lte: candidateDates[candidateDates.length - 1],
        },
      },
      select: { scheduled_at: true },
    });

    const existingMs = new Set(existing.map((l) => l.scheduled_at.getTime()));
    const newDates = candidateDates.filter((dt) => !existingMs.has(dt.getTime()));
    const skipped = candidateDates.length - newDates.length;

    if (!newDates.length) return { created: 0, skipped };

    // Создаём пачкой
    await this.prisma.lesson.createMany({
      data: newDates.map((scheduledAt) => ({
        class_id: classId,
        scheduled_at: scheduledAt,
        duration_min: duration,
        status: 'SCHEDULED' as const,
      })),
    });

    // Получаем IDs созданных уроков для планирования напоминаний
    const created = await this.prisma.lesson.findMany({
      where: { class_id: classId, scheduled_at: { in: newDates } },
      select: { id: true, scheduled_at: true },
    });

    // Планируем напоминания (fire-and-forget; сервис игнорирует если < 1ч)
    for (const lesson of created) {
      void this.notifications.scheduleLessonReminder(lesson.id, classId, lesson.scheduled_at);
    }

    return { created: created.length, skipped };
  }

  /**
   * GET /lessons/teacher/stats — сводная статистика учителя.
   */
  async getTeacherStats(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId } });
    if (!teacher) {
      return {
        classes_count: 0,
        total_lessons: 0,
        total_students: 0,
        avg_attendance_pct: 0,
        homework_graded: 0,
      };
    }

    const [classesCount, totalLessons, homeworkGraded] = await Promise.all([
      this.prisma.class.count({ where: { teacher_id: teacher.id } }),
      this.prisma.lesson.count({
        where: { class: { teacher_id: teacher.id }, status: 'COMPLETED' },
      }),
      this.prisma.homeworkSubmission.count({
        where: {
          homework: { class: { teacher_id: teacher.id } },
          status: 'GRADED',
        },
      }),
    ]);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { class: { teacher_id: teacher.id }, status: 'ACTIVE' },
      select: { student_id: true },
    });
    const totalStudents = new Set(enrollments.map((e) => e.student_id)).size;

    const [totalAtt, presentAtt] = await Promise.all([
      this.prisma.lessonAttendance.count({
        where: { lesson: { class: { teacher_id: teacher.id } } },
      }),
      this.prisma.lessonAttendance.count({
        where: {
          lesson: { class: { teacher_id: teacher.id } },
          status: { in: ['PRESENT', 'LATE'] },
        },
      }),
    ]);

    const avgAttendancePct = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

    return {
      classes_count: classesCount,
      total_lessons: totalLessons,
      total_students: totalStudents,
      avg_attendance_pct: avgAttendancePct,
      homework_graded: homeworkGraded,
    };
  }

  /**
   * GET /lessons/teacher/today — уроки учителя на сегодня (UTC+5).
   */
  async getTodayLessons(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId } });
    if (!teacher) return [];

    // Границы сегодняшнего дня в UTC+5 (Ташкент) → конвертируем в UTC для Prisma
    const nowUtc = new Date();
    const tzOffsetMs = 5 * 60 * 60 * 1000;
    const nowTz = new Date(nowUtc.getTime() + tzOffsetMs);
    const y = nowTz.getUTCFullYear();
    const mo = nowTz.getUTCMonth();
    const d = nowTz.getUTCDate();
    const startUtc = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0) - tzOffsetMs);
    const endUtc = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999) - tzOffsetMs);

    const lessons = await this.prisma.lesson.findMany({
      where: {
        class: { teacher_id: teacher.id },
        scheduled_at: { gte: startUtc, lte: endUtc },
        status: { not: 'CANCELLED' },
      },
      include: {
        class: {
          include: {
            language: true,
            _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
          },
        },
        _count: { select: { attendances: true } },
      },
      orderBy: { scheduled_at: 'asc' },
    });

    return lessons.map((l) => ({
      id: l.id,
      title: l.title,
      scheduled_at: l.scheduled_at,
      duration_min: l.duration_min,
      status: l.status,
      notes: l.notes,
      class: {
        id: l.class.id,
        title: l.class.title,
        language: { name_ru: l.class.language.name_ru, flag_emoji: l.class.language.flag_emoji },
        enrolled_count: l.class._count.enrollments,
      },
      attendance_count: l._count.attendances,
    }));
  }

  /**
   * GET /lessons/teacher/pending-hw — ДЗ на проверке у учителя (status = SUBMITTED).
   */
  async getPendingHomework(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId } });
    if (!teacher) return [];

    const classes = await this.prisma.class.findMany({
      where: { teacher_id: teacher.id },
      select: { id: true, title: true },
    });
    const classIds = classes.map((c) => c.id);
    if (!classIds.length) return [];

    return this.prisma.homeworkSubmission.findMany({
      where: {
        homework: { class_id: { in: classIds } },
        status: 'SUBMITTED',
      },
      include: {
        student: { select: { id: true, first_name: true, last_name: true } },
        homework: {
          select: {
            id: true,
            title: true,
            class: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { submitted_at: 'asc' },
      take: 50,
    });
  }

  /**
   * GET /lessons/:id/attendance — посещаемость конкретного урока.
   */
  async getLessonAttendance(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    return this.prisma.lessonAttendance.findMany({
      where: { lesson_id: lessonId },
      include: { student: { select: { id: true, first_name: true, last_name: true } } },
    });
  }

  /**
   * GET /lessons/attendance/my — посещаемость студента по классам.
   */
  async getMyAttendance(studentId: string) {
    const attendances = await this.prisma.lessonAttendance.findMany({
      where: { student_id: studentId },
      select: {
        status: true,
        lesson: {
          select: {
            id: true,
            scheduled_at: true,
            class: {
              select: {
                id: true,
                title: true,
                language: { select: { name_ru: true, flag_emoji: true, color: true } },
              },
            },
          },
        },
      },
      orderBy: { lesson: { scheduled_at: 'desc' } },
    });

    const byClass = new Map<
      string,
      {
        classId: string;
        title: string;
        language: { name_ru: string; flag_emoji: string; color: string | null };
        total: number;
        present: number;
        late: number;
        absent: number;
        excused: number;
      }
    >();

    for (const a of attendances) {
      const cls = a.lesson.class;
      if (!byClass.has(cls.id)) {
        byClass.set(cls.id, {
          classId: cls.id,
          title: cls.title,
          language: cls.language,
          total: 0,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
        });
      }
      const entry = byClass.get(cls.id)!;
      entry.total++;
      if (a.status === 'PRESENT') entry.present++;
      else if (a.status === 'LATE') entry.late++;
      else if (a.status === 'ABSENT') entry.absent++;
      else if (a.status === 'EXCUSED') entry.excused++;
    }

    return Array.from(byClass.values()).map((c) => ({
      ...c,
      attendance_pct: c.total > 0 ? Math.round(((c.present + c.late) / c.total) * 100) : 0,
    }));
  }
}
