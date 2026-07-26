import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClassStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Сколько занятий подряд студент должен пропустить, чтобы считаться уходящим.
 * Два пропуска — обычная жизнь (болезнь, командировка). Три подряд почти всегда
 * означают, что человек уже перестал ходить, просто ещё не сказал об этом.
 */
const CONSECUTIVE_ABSENCES = 3;

/**
 * DropoutRiskService — ищет студентов, которые вот-вот перестанут учиться.
 *
 * Школа узнаёт об уходе студента, когда он не платит за следующий месяц —
 * то есть когда возвращать его уже поздно. Пропуски видно на несколько недель
 * раньше, и данные для этого в базе есть: не хватало только того, кто на них
 * смотрит.
 *
 * Считаем только по занятиям с подтверждённой посещаемостью
 * (attendance_marked_at). Урок, закрытый авто-джобом, отметок не имеет, и
 * принять его отсутствие за пропуск означало бы обвинить студента в том,
 * что учитель забыл нажать кнопку.
 */
@Injectable()
export class DropoutRiskService {
  private readonly logger = new Logger(DropoutRiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Каждый день в 9 утра — к началу рабочего дня менеджера. */
  @Cron('0 9 * * *')
  async runDaily(): Promise<void> {
    const flagged = await this.findAtRisk();

    for (const s of flagged) {
      const who = s.student_name + (s.telegram_username ? ` (@${s.telegram_username})` : '');
      await this.notifications.notifyStaffNewRequest(
        '⚠️ Риск ухода студента',
        `<b>${who}</b> пропустил ${s.missed} занятия подряд.\n` +
          `Группа: <b>${s.class_title}</b>\n` +
          `Последнее посещённое: ${s.last_attended ?? 'ни одного'}\n\n` +
          `Стоит позвонить, пока он не ушёл насовсем.`,
        // Дедуп по студенту и группе: пока он числится в риске, напоминаем
        // раз в сутки, а не на каждое пропущенное занятие.
        `dropout:${s.student_id}:${s.class_id}`,
      );
    }

    if (flagged.length > 0) {
      this.logger.log(`Dropout risk: flagged ${flagged.length} student(s)`);
    }
  }

  /**
   * Студенты с CONSECUTIVE_ABSENCES пропусками подряд.
   * Публичный метод — тот же список отдаётся менеджеру по запросу из админки.
   */
  async findAtRisk(): Promise<
    {
      student_id: string;
      student_name: string;
      telegram_username: string | null;
      class_id: string;
      class_title: string;
      missed: number;
      last_attended: string | null;
    }[]
  > {
    const classes = await this.prisma.class.findMany({
      where: { status: { in: [ClassStatus.ACTIVE, ClassStatus.EXAM] } },
      select: {
        id: true,
        title: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          select: {
            student_id: true,
            student: {
              select: { first_name: true, last_name: true, telegram_username: true },
            },
          },
        },
        lessons: {
          where: { attendance_marked_at: { not: null } },
          orderBy: { scheduled_at: 'desc' },
          take: CONSECUTIVE_ABSENCES,
          select: {
            id: true,
            scheduled_at: true,
            attendances: { select: { student_id: true, status: true } },
          },
        },
      },
    });

    const flagged = [];

    for (const cls of classes) {
      // Пока в группе не набралось нужного числа подтверждённых занятий,
      // говорить о серии пропусков не о чем.
      if (cls.lessons.length < CONSECUTIVE_ABSENCES) continue;

      for (const enr of cls.enrollments) {
        const marks = cls.lessons.map((l) => ({
          at: l.scheduled_at,
          status: l.attendances.find((a) => a.student_id === enr.student_id)?.status,
        }));

        // Студент, которого не отметили вообще (записался позже этих занятий),
        // прогульщиком не считается.
        if (marks.some((m) => m.status === undefined)) continue;
        if (!marks.every((m) => m.status === 'ABSENT')) continue;

        const lastAttended = await this.prisma.lessonAttendance.findFirst({
          where: {
            student_id: enr.student_id,
            status: { in: ['PRESENT', 'LATE'] },
            lesson: { class_id: cls.id },
          },
          orderBy: { lesson: { scheduled_at: 'desc' } },
          select: { lesson: { select: { scheduled_at: true } } },
        });

        flagged.push({
          student_id: enr.student_id,
          student_name:
            `${enr.student.first_name} ${enr.student.last_name ?? ''}`.trim() || 'Без имени',
          telegram_username: enr.student.telegram_username,
          class_id: cls.id,
          class_title: cls.title,
          missed: CONSECUTIVE_ABSENCES,
          last_attended: lastAttended
            ? lastAttended.lesson.scheduled_at.toISOString().slice(0, 10)
            : null,
        });
      }
    }

    return flagged;
  }
}
