import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EnrollmentsService } from './enrollments.service';
import { TelegramService } from '../telegram/telegram.service';

/**
 * Грейс после истечения оплаты, прежде чем снять доступ.
 * Совпадает с окном напоминаний billing-reminder (до −7 дней просрочки):
 * сначала студент получает напоминания, и только потом теряет место.
 */
const PAID_GRACE_DAYS = 7;

/**
 * Сколько дней «висящая» PENDING-запись (записался, но так и не оплатил)
 * держит место, прежде чем его освободить для листа ожидания.
 */
const STALE_PENDING_DAYS = 3;

interface DroppedRow {
  id: string;
  student_id: string;
  class_id: string;
  class: { title: string };
}

@Injectable()
export class EnrollmentMaintenanceService {
  private readonly logger = new Logger(EnrollmentMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly enrollments: EnrollmentsService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * Убирает студентов из чатов их классов после массового отчисления.
   *
   * Раньше не вызывалось нигде: у кого истёк пробный или оплаченный период,
   * оставался в группе класса навсегда и продолжал читать переписку.
   */
  private async removeFromClassChats(enrollmentIds: string[]): Promise<void> {
    if (enrollmentIds.length === 0) return;

    const rows = await this.prisma.enrollment.findMany({
      where: { id: { in: enrollmentIds } },
      select: {
        student: { select: { telegram_user_id: true } },
        class: { select: { telegram_chat_id: true } },
      },
    });

    for (const r of rows) {
      if (r.class.telegram_chat_id && r.student.telegram_user_id) {
        await this.telegram.removeFromClassChat(
          r.student.telegram_user_id,
          r.class.telegram_chat_id,
        );
      }
    }
  }

  /**
   * Ежедневное обслуживание записей (01:00 UTC).
   * Порядок: сначала снимаем протухшие → потом промоушены (внутри каждого метода)
   * заполняют освободившиеся места из листа ожидания.
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDaily(): Promise<void> {
    await this.expireTrials();
    await this.expirePaidAccess();
    await this.cleanupStalePending();
  }

  /**
   * Истёкшие trial-записи → DROPPED.
   * trial_expires_at < NOW() AND is_trial = true AND status IN (ACTIVE, PENDING).
   * Освободившиеся места промотируются из листа ожидания.
   */
  async expireTrials(): Promise<void> {
    const now = new Date();

    const expired = await this.prisma.enrollment.findMany({
      where: {
        is_trial: true,
        status: { in: ['ACTIVE', 'PENDING'] },
        trial_expires_at: { lt: now },
      },
      select: {
        id: true,
        student_id: true,
        class_id: true,
        class: { select: { title: true } },
      },
    });

    if (expired.length === 0) return;

    this.logger.log(`Expiring ${expired.length} trial enrollment(s)`);

    await this.prisma.enrollment.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: { status: 'DROPPED' },
    });

    await this.removeFromClassChats(expired.map((e) => e.id));

    for (const e of expired) {
      void this.notifications.scheduleEnrollmentDropped(e.student_id, e.class.title, e.id);
    }
    await this.promoteForDropped(expired);
  }

  /**
   * A1 — просроченный доступ: платная ACTIVE-запись, у которой paid_until
   * истёк более PAID_GRACE_DAYS дней назад → DROPPED. Раньше такая запись
   * оставалась ACTIVE вечно (студент держал место, не платя).
   * Освободившиеся места промотируются из листа ожидания.
   */
  async expirePaidAccess(): Promise<void> {
    const cutoff = new Date(Date.now() - PAID_GRACE_DAYS * 86_400_000);

    const expired = await this.prisma.enrollment.findMany({
      where: {
        status: 'ACTIVE',
        is_trial: false,
        paid_until: { not: null, lt: cutoff },
      },
      select: {
        id: true,
        student_id: true,
        class_id: true,
        class: { select: { title: true } },
      },
    });

    if (expired.length === 0) return;

    this.logger.log(`Expiring paid access for ${expired.length} enrollment(s) (grace passed)`);

    await this.prisma.enrollment.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: { status: 'DROPPED' },
    });

    await this.removeFromClassChats(expired.map((e) => e.id));

    for (const e of expired) {
      void this.notifications.scheduleAccessExpired(e.student_id, e.class.title, e.id);
    }
    await this.promoteForDropped(expired);
  }

  /**
   * A3 — «висящие» PENDING: записался, но не оплатил дольше STALE_PENDING_DAYS.
   * PENDING держит место (лимит класса считает ACTIVE + PENDING), поэтому без
   * чистки класс забивается «призраками». → DROPPED + промоушен листа ожидания.
   */
  async cleanupStalePending(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_PENDING_DAYS * 86_400_000);

    const stale = await this.prisma.enrollment.findMany({
      where: {
        status: 'PENDING',
        is_trial: false,
        enrolled_at: { lt: cutoff },
      },
      select: {
        id: true,
        student_id: true,
        class_id: true,
        class: { select: { title: true } },
      },
    });

    if (stale.length === 0) return;

    this.logger.log(`Dropping ${stale.length} stale PENDING enrollment(s)`);

    await this.prisma.enrollment.updateMany({
      where: { id: { in: stale.map((e) => e.id) } },
      data: { status: 'DROPPED' },
    });

    await this.removeFromClassChats(stale.map((e) => e.id));

    for (const e of stale) {
      void this.notifications.scheduleEnrollmentDropped(e.student_id, e.class.title, e.id);
    }
    await this.promoteForDropped(stale);
  }

  /**
   * Каждое освободившееся место → одно повышение из листа ожидания.
   * Последовательно (await), чтобы параллельные вызовы не выбрали одного и того же
   * первого в очереди. promoteWaitlist сам ничего не делает, если очередь пуста.
   */
  private async promoteForDropped(dropped: DroppedRow[]): Promise<void> {
    for (const e of dropped) {
      await this.enrollments.promoteWaitlist(e.class_id, e.class.title);
    }
  }
}
