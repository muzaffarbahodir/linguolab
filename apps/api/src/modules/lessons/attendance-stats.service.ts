import { Injectable } from '@nestjs/common';
import { ClassStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/** PRESENT и LATE считаем посещением: человек пришёл, пусть и с опозданием. */
const ATTENDED = ['PRESENT', 'LATE'] as const;

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * AttendanceStatsService — посещаемость в разрезах, на которых принимают решения.
 *
 * До этого процент посещаемости считался ровно в одном месте — в кабинете
 * родителя, по одному ребёнку. Ни по группе, ни по преподавателю, ни по школе
 * его нельзя было увидеть, хотя это первая цифра, которую спрашивают: она
 * показывает, какая группа рассыпается и какой преподаватель теряет людей.
 *
 * Везде учитываются только занятия с подтверждённой посещаемостью: у
 * авто-закрытых уроков отметок нет, и включать их в знаменатель означало бы
 * занижать статистику из-за забывчивости преподавателя.
 */
@Injectable()
export class AttendanceStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Сводка по школе за период. */
  async overview(since: Date, until: Date) {
    const rows = await this.prisma.lessonAttendance.groupBy({
      by: ['status'],
      where: {
        lesson: { scheduled_at: { gte: since, lt: until }, attendance_marked_at: { not: null } },
      },
      _count: { _all: true },
    });

    const counts = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    const present = (counts.PRESENT ?? 0) + (counts.LATE ?? 0);
    const total = rows.reduce((s, r) => s + r._count._all, 0);

    const [confirmed, unconfirmed] = await Promise.all([
      this.prisma.lesson.count({
        where: {
          status: 'COMPLETED',
          attendance_marked_at: { not: null },
          scheduled_at: { gte: since, lt: until },
        },
      }),
      this.prisma.lesson.count({
        where: {
          status: 'COMPLETED',
          attendance_marked_at: null,
          scheduled_at: { gte: since, lt: until },
        },
      }),
    ]);

    return {
      attendance_rate: pct(present, total),
      present: counts.PRESENT ?? 0,
      late: counts.LATE ?? 0,
      absent: counts.ABSENT ?? 0,
      excused: counts.EXCUSED ?? 0,
      total_marks: total,
      lessons_confirmed: confirmed,
      // Сколько занятий закрылось само: показатель дисциплины преподавателей и
      // одновременно мера того, насколько можно доверять проценту выше.
      lessons_unconfirmed: unconfirmed,
    };
  }

  /** Посещаемость по группам — какая группа рассыпается. */
  async byClass(since: Date, until: Date) {
    const classes = await this.prisma.class.findMany({
      where: { status: { in: [ClassStatus.ACTIVE, ClassStatus.EXAM, ClassStatus.COMPLETED] } },
      select: {
        id: true,
        title: true,
        teacher: { select: { user: { select: { first_name: true, last_name: true } } } },
        _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
        lessons: {
          where: { scheduled_at: { gte: since, lt: until }, attendance_marked_at: { not: null } },
          select: { attendances: { select: { status: true } } },
        },
      },
    });

    return classes
      .map((c) => {
        const marks = c.lessons.flatMap((l) => l.attendances);
        const present = marks.filter((m) => ATTENDED.includes(m.status as never)).length;
        return {
          class_id: c.id,
          class_title: c.title,
          teacher: `${c.teacher.user.first_name} ${c.teacher.user.last_name ?? ''}`.trim(),
          active_students: c._count.enrollments,
          lessons_held: c.lessons.length,
          attendance_rate: pct(present, marks.length),
          total_marks: marks.length,
        };
      })
      .sort((a, b) => a.attendance_rate - b.attendance_rate); // худшие сверху
  }

  /** Посещаемость по студентам — кого пора возвращать. */
  async byStudent(since: Date, until: Date, limit = 50) {
    const rows = await this.prisma.lessonAttendance.groupBy({
      by: ['student_id', 'status'],
      where: {
        lesson: { scheduled_at: { gte: since, lt: until }, attendance_marked_at: { not: null } },
      },
      _count: { _all: true },
    });

    const byStudent = new Map<string, { present: number; total: number }>();
    for (const r of rows) {
      const acc = byStudent.get(r.student_id) ?? { present: 0, total: 0 };
      acc.total += r._count._all;
      if (ATTENDED.includes(r.status as never)) acc.present += r._count._all;
      byStudent.set(r.student_id, acc);
    }

    const students = await this.prisma.user.findMany({
      where: { id: { in: [...byStudent.keys()] } },
      select: { id: true, first_name: true, last_name: true, telegram_username: true },
    });

    return students
      .map((u) => {
        const acc = byStudent.get(u.id)!;
        return {
          student_id: u.id,
          name: `${u.first_name} ${u.last_name ?? ''}`.trim(),
          telegram_username: u.telegram_username,
          attended: acc.present,
          total: acc.total,
          attendance_rate: pct(acc.present, acc.total),
        };
      })
      .sort((a, b) => a.attendance_rate - b.attendance_rate)
      .slice(0, limit);
  }

  /** Посещаемость по преподавателям — у кого группы держатся, у кого тают. */
  async byTeacher(since: Date, until: Date) {
    const teachers = await this.prisma.teacher.findMany({
      select: {
        id: true,
        user: { select: { first_name: true, last_name: true } },
        classes: {
          select: {
            lessons: {
              where: {
                scheduled_at: { gte: since, lt: until },
                attendance_marked_at: { not: null },
              },
              select: { attendances: { select: { status: true } } },
            },
            _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    });

    return teachers
      .map((t) => {
        const lessons = t.classes.flatMap((c) => c.lessons);
        const marks = lessons.flatMap((l) => l.attendances);
        const present = marks.filter((m) => ATTENDED.includes(m.status as never)).length;
        return {
          teacher_id: t.id,
          name: `${t.user.first_name} ${t.user.last_name ?? ''}`.trim(),
          classes: t.classes.length,
          active_students: t.classes.reduce((s, c) => s + c._count.enrollments, 0),
          lessons_held: lessons.length,
          attendance_rate: pct(present, marks.length),
        };
      })
      .filter((t) => t.lessons_held > 0)
      .sort((a, b) => a.attendance_rate - b.attendance_rate);
  }
}
