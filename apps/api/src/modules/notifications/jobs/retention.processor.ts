/**
 * RetentionProcessor — BullMQ воркер для retention-кампаний.
 *
 * Запускается один раз в сутки через repeatable job (cron: '0 10 * * *' UTC = 15:00 UTC+5).
 * При каждом запуске:
 *  1. Ищет студентов с last_active_at < 7 дней назад (не более 100)
 *  2. Для каждого отправляет retention-напоминание через NotificationsService
 *  3. Ищет студентов с просроченными несданными ДЗ → напоминание об overdue
 *
 * Deduplication через Redis SETEX обеспечивает: один студент получит
 * не более одного retention-уведомления в сутки (TTL 24ч).
 *
 * Как регистрируется: NotificationsModule.onModuleInit() добавляет
 * repeatable job в retention-очередь при старте приложения.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';
import { RETENTION_QUEUE } from '../notification.types';

export interface RetentionJobData {
  /** Тип кампании */
  campaign: 'inactive_students' | 'homework_overdue';
}

@Processor(RETENTION_QUEUE)
export class RetentionProcessor extends WorkerHost {
  private readonly logger = new Logger(RetentionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<RetentionJobData>): Promise<void> {
    this.logger.log(`RetentionJob: campaign=${job.data.campaign} jobId=${job.id}`);

    if (job.data.campaign === 'inactive_students') {
      await this.runInactiveStudentsCampaign();
    } else if (job.data.campaign === 'homework_overdue') {
      await this.runHomeworkOverdueCampaign();
    }
  }

  /**
   * Inactive students campaign:
   * Студенты с last_active_at < (now - 7 days) у которых есть
   * ACTIVE enrollment → напоминание вернуться в приложение.
   *
   * Limit 100 на запуск, чтобы не перегружать TG API.
   */
  private async runInactiveStudentsCampaign(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        role: 'STUDENT',
        tg_blocked: false,
        // telegram_user_id — BigInt @unique non-nullable, фильтр не нужен
        last_active_at: { lt: cutoff },
        // Только тех кто записан хотя бы в один класс
        enrollments: { some: { status: 'ACTIVE' } },
      },
      select: { id: true },
      take: 100,
      orderBy: { last_active_at: 'asc' }, // самые давние — первые
    });

    this.logger.log(`InactiveStudents: found ${users.length} users`);

    for (const user of users) {
      try {
        await this.notifications.scheduleRetentionReminder(user.id);
      } catch (err) {
        this.logger.error(`RetentionReminder failed for user=${user.id}: ${String(err)}`);
      }
    }
  }

  /**
   * Homework overdue campaign:
   * Студенты у которых есть SUBMITTED=false ДЗ с due_date < now.
   * Отправляем напоминание о каждом просроченном задании (limit 1 per ДЗ per day via dedup).
   *
   * Limit 100 enrollments на запуск.
   */
  private async runHomeworkOverdueCampaign(): Promise<void> {
    const now = new Date();

    // Ищем ДЗ у которых:
    // - due_date прошёл
    // - есть студенты с ACTIVE enrollment в этом классе
    // - у этих студентов нет submission (или submission не в статусе GRADED)
    const overdueHws = await this.prisma.homework.findMany({
      where: {
        due_date: { lt: now },
        class: {
          enrollments: { some: { status: 'ACTIVE' } },
        },
      },
      select: {
        id: true,
        title: true,
        class: {
          select: {
            enrollments: {
              where: { status: 'ACTIVE' },
              select: {
                student_id: true,
                student: { select: { tg_blocked: true } },
              },
            },
          },
        },
        submissions: {
          where: { status: 'GRADED' },
          select: { student_id: true },
        },
      },
      take: 20, // max 20 ДЗ за запуск
    });

    let notified = 0;
    for (const hw of overdueHws) {
      // Студенты которые уже сдали → пропускаем
      const gradedStudentIds = new Set(hw.submissions.map((s) => s.student_id));

      for (const enrollment of hw.class.enrollments) {
        if (gradedStudentIds.has(enrollment.student_id)) continue;
        if (enrollment.student.tg_blocked) continue;

        try {
          await this.notifications.scheduleHomeworkOverdueReminder(enrollment.student_id, hw.title);
          notified++;
        } catch (err) {
          this.logger.error(`OverdueReminder failed: ${String(err)}`);
        }
      }
    }

    this.logger.log(`HomeworkOverdue: notified ${notified} students`);
  }
}
