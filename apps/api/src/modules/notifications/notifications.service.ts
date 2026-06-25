import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Role } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATIONS_QUEUE,
  NotificationJobData,
  NotificationType,
  DEDUP_TTL,
} from './notification.types';

/**
 * NotificationsService — оркестратор уведомлений.
 *
 * Не отправляет напрямую — ставит задания в BullMQ очередь `notifications`.
 * Воркер NotificationSendProcessor выполняет реальную отправку (retry, dedup).
 *
 * Публичное API:
 *  - schedulePaymentConfirmed(paymentId, userId, amountTiyin)
 *  - schedulePaymentRefunded(paymentId, userId, amountTiyin)
 *  - scheduleLessonReminder(lessonId, classId, scheduledAt)  — delayed job за 1ч до урока
 *  - scheduleHomeworkNew(classId, homeworkId, title)          — уведомление всем студентам класса
 *  - send(opts)                                               — универсальный метод
 *
 * REST (через NotificationsController):
 *  - myNotifications(userId)
 *  - markRead(id, userId)
 *  - markAllRead(userId)
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue<NotificationJobData>,
  ) {}

  // ─── Специализированные триггеры ─────────────────────────────────────────

  /**
   * Уведомление об успешной оплате.
   * Вызывается fire-and-forget из PaymeService / ClickService после PAID.
   */
  async schedulePaymentConfirmed(
    paymentId: string,
    userId: string,
    amountTiyin: bigint,
  ): Promise<void> {
    const amountUzs = Math.round(Number(amountTiyin) / 100).toLocaleString('ru-RU');

    await this.enqueue({
      type: NotificationType.PAYMENT_CONFIRMED,
      userId,
      title: '✅ Оплата прошла успешно',
      body: `Сумма: <b>${amountUzs} UZS</b>\n\n` + `Ваш платёж подтверждён. Приятной учёбы! 🎓`,
      dedupKey: `notif:dedup:payment_confirmed:${paymentId}`,
      dedupTtlSec: DEDUP_TTL.PAYMENT_CONFIRMED,
      payload: { paymentId },
    });
  }

  /**
   * Уведомление о возврате средств.
   * Вызывается fire-and-forget из PaymentsService.adminRefund() после REFUNDED.
   */
  async schedulePaymentRefunded(
    paymentId: string,
    userId: string,
    amountTiyin: bigint,
  ): Promise<void> {
    const amountUzs = Math.round(Number(amountTiyin) / 100).toLocaleString('ru-RU');

    await this.enqueue({
      type: NotificationType.PAYMENT_REFUNDED,
      userId,
      title: '↩️ Возврат средств',
      body:
        `Сумма: <b>${amountUzs} UZS</b>\n\n` +
        `Возврат обработан. Средства поступят на ваш счёт в течение 1–3 рабочих дней.`,
      dedupKey: `notif:dedup:payment_refunded:${paymentId}`,
      dedupTtlSec: DEDUP_TTL.PAYMENT_REFUNDED,
      payload: { paymentId },
    });
  }

  /**
   * Напоминание об уроке за 1 час (delayed BullMQ job).
   * Вызывается из LessonsService.createLesson() после создания урока.
   *
   * Для каждого ACTIVE студента класса создаётся отдельный delayed job.
   * Если до урока < 1ч или урок уже прошёл — delayed job не создаётся.
   */
  async scheduleLessonReminder(
    lessonId: string,
    classId: string,
    scheduledAt: Date,
  ): Promise<void> {
    // Откладываем на scheduledAt - 1ч
    const fireAt = scheduledAt.getTime() - 60 * 60 * 1000;
    const delay = fireAt - Date.now();

    if (delay <= 0) {
      this.logger.debug(
        `Lesson ${lessonId} is too soon (${Math.round(delay / 60000)}m) — skip reminder`,
      );
      return;
    }

    // Получаем класс и его студентов
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        title: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          select: { student_id: true },
        },
      },
    });

    if (!cls || cls.enrollments.length === 0) return;

    const dateStr = scheduledAt.toLocaleString('ru-RU', {
      timeZone: 'Asia/Tashkent',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const { student_id } of cls.enrollments) {
      await this.enqueue(
        {
          type: NotificationType.LESSON_REMINDER,
          userId: student_id,
          title: '🔔 Занятие через 1 час',
          body: `Группа: <b>${cls.title}</b>\nВремя: ${dateStr} (UTC+5)\n\nПодготовьтесь к занятию!`,
          dedupKey: `notif:dedup:lesson_reminder:${lessonId}:${student_id}`,
          dedupTtlSec: DEDUP_TTL.LESSON_REMINDER,
          payload: { lessonId, classId },
        },
        { delay },
      );
    }

    this.logger.log(
      `Lesson reminder scheduled: lesson=${lessonId} students=${cls.enrollments.length} ` +
        `delay=${Math.round(delay / 60000)}m`,
    );
  }

  /**
   * Уведомление о новом домашнем задании.
   * Вызывается из HomeworkService.create() после создания ДЗ.
   * Оповещает всех ACTIVE студентов класса.
   */
  async scheduleHomeworkNew(
    classId: string,
    homeworkId: string,
    homeworkTitle: string,
  ): Promise<void> {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        title: true,
        enrollments: {
          where: { status: 'ACTIVE' },
          select: { student_id: true },
        },
      },
    });

    if (!cls || cls.enrollments.length === 0) return;

    for (const { student_id } of cls.enrollments) {
      await this.enqueue({
        type: NotificationType.HOMEWORK_NEW,
        userId: student_id,
        title: '📚 Новое домашнее задание',
        body: `Группа: <b>${cls.title}</b>\nЗадание: ${homeworkTitle}\n\nОткройте приложение чтобы посмотреть детали.`,
        dedupKey: `notif:dedup:homework_new:${homeworkId}:${student_id}`,
        dedupTtlSec: DEDUP_TTL.HOMEWORK_NEW,
        payload: { homeworkId, classId },
      });
    }

    this.logger.log(
      `Homework notification scheduled: hw=${homeworkId} class=${classId} ` +
        `students=${cls.enrollments.length}`,
    );
  }

  // ─── Родительские уведомления ────────────────────────────────────────────

  /**
   * Уведомляет родителей об отсутствии ребёнка на занятии.
   * Вызывается из LessonsService.bulkAttendance() для каждого ABSENT студента.
   */
  async notifyParentsOfAbsent(
    childId: string,
    childName: string,
    classTitle: string,
    lessonDate: Date,
  ): Promise<void> {
    const parents = await this.getParentsOf(childId);
    if (!parents.length) return;

    const dateStr = lessonDate.toLocaleString('ru-RU', {
      timeZone: 'Asia/Tashkent',
      day: '2-digit',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    for (const parentId of parents) {
      await this.enqueue({
        type: NotificationType.PARENT_CHILD_ABSENT,
        userId: parentId,
        title: '⚠️ Ребёнок пропустил занятие',
        body: `${childName} отсутствовал(а) на занятии.\nГруппа: <b>${classTitle}</b>\nДата: ${dateStr} (UTC+5)`,
        dedupKey: `notif:dedup:parent_absent:${childId}:${parentId}:${lessonDate.toISOString()}`,
        dedupTtlSec: DEDUP_TTL.PARENT_CHILD_ABSENT,
        payload: { childId, classTitle },
      });
    }
  }

  /**
   * Уведомляет родителей о новом домашнем задании у ребёнка.
   * Вызывается из HomeworkService.create() для каждого enrolled студента.
   */
  async notifyParentsOfHomeworkNew(
    childId: string,
    childName: string,
    classTitle: string,
    homeworkId: string,
    hwTitle: string,
  ): Promise<void> {
    const parents = await this.getParentsOf(childId);
    if (!parents.length) return;

    for (const parentId of parents) {
      await this.enqueue({
        type: NotificationType.PARENT_CHILD_HOMEWORK_NEW,
        userId: parentId,
        title: '📚 Новое ДЗ у ребёнка',
        body: `${childName} получил(а) новое задание.\nГруппа: <b>${classTitle}</b>\nЗадание: ${hwTitle}`,
        dedupKey: `notif:dedup:parent_hw_new:${homeworkId}:${childId}:${parentId}`,
        dedupTtlSec: DEDUP_TTL.PARENT_CHILD_HOMEWORK_NEW,
        payload: { childId, homeworkId },
      });
    }
  }

  /**
   * Уведомляет родителей об оценке за ДЗ ребёнка.
   * Вызывается из HomeworkService.grade().
   */
  async notifyParentsOfGrade(
    childId: string,
    childName: string,
    submissionId: string,
    hwTitle: string,
    grade: number,
    feedback?: string | null,
  ): Promise<void> {
    const parents = await this.getParentsOf(childId);
    if (!parents.length) return;

    const feedbackLine = feedback ? `\nКомментарий: ${feedback}` : '';

    for (const parentId of parents) {
      await this.enqueue({
        type: NotificationType.PARENT_CHILD_GRADE_RECEIVED,
        userId: parentId,
        title: '📝 Оценка за домашнее задание',
        body: `${childName} получил(а) оценку.\nЗадание: ${hwTitle}\nОценка: <b>${grade}/100</b>${feedbackLine}`,
        dedupKey: `notif:dedup:parent_grade:${submissionId}:${parentId}`,
        dedupTtlSec: DEDUP_TTL.PARENT_CHILD_GRADE_RECEIVED,
        payload: { childId, submissionId, grade },
      });
    }
  }

  // ─── Onboarding + Retention ──────────────────────────────────────────────

  /**
   * Приветственное сообщение новому пользователю.
   * Вызывается из AuthService после первого логина.
   *
   * Дедупликация по userId с TTL 1 год — пользователь получит только одно
   * приветствие за всю жизнь аккаунта, даже при повторных вызовах.
   */
  async scheduleWelcome(userId: string, firstName: string): Promise<void> {
    await this.enqueue({
      type: NotificationType.WELCOME,
      userId,
      title: '👋 Добро пожаловать в LinguoLab!',
      body:
        `Привет, <b>${firstName}</b>! 🎉\n\n` +
        `<b>LinguoLab</b> — языковой центр в Telegram:\n` +
        `• 📚 Курсы EN / ES / FR / ZH / UZ\n` +
        `• 📅 Запись на занятия\n` +
        `• 📝 Домашние задания\n` +
        `• 🏆 Достижения и сертификаты\n\n` +
        `Начните с записи на пробный урок — это бесплатно! 👇`,
      dedupKey: `notif:dedup:welcome:${userId}`,
      dedupTtlSec: DEDUP_TTL.WELCOME,
      payload: { userId },
    });
  }

  /**
   * Напоминание неактивному студенту (отправляется cron-джобом каждый день).
   * Пользователь не открывал приложение > 7 дней.
   */
  async scheduleRetentionReminder(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { first_name: true, last_active_at: true },
    });
    if (!user) return;

    const daysAgo = Math.floor((Date.now() - user.last_active_at.getTime()) / 86_400_000);

    await this.enqueue({
      type: NotificationType.RETENTION_REMINDER,
      userId,
      title: '📖 Скучаем по вам!',
      body:
        `Привет, <b>${user.first_name}</b>! 👋\n\n` +
        `Вы не заходили в LinguoLab уже <b>${daysAgo} дн.</b>\n\n` +
        `Ваши занятия ждут — вернитесь и продолжите обучение! 🎓`,
      dedupKey: `notif:dedup:retention:${userId}:${new Date().toISOString().slice(0, 10)}`,
      dedupTtlSec: DEDUP_TTL.RETENTION_REMINDER,
      payload: { userId, daysAgo },
    });
  }

  /**
   * Напоминание о просроченных домашних заданиях.
   * Отправляется cron-джобом 2 раза в день.
   */
  async scheduleHomeworkOverdueReminder(userId: string, hwTitle: string): Promise<void> {
    await this.enqueue({
      type: NotificationType.HOMEWORK_OVERDUE,
      userId,
      title: '⏰ Не забудьте про домашнее задание',
      body:
        `Срок сдачи задания <b>«${hwTitle}»</b> уже прошёл.\n\n` +
        `Сдайте ДЗ как можно скорее — преподаватель ждёт! 📚`,
      dedupKey: `notif:dedup:hw_overdue:${userId}:${hwTitle}:${new Date().toISOString().slice(0, 10)}`,
      dedupTtlSec: DEDUP_TTL.HOMEWORK_OVERDUE,
      payload: { userId },
    });
  }

  // ─── Тестовое уведомление ────────────────────────────────────────────────

  /**
   * POST /notifications/test — отправить себе тестовое уведомление.
   * Проверяет полный pipeline: BullMQ → processor → Telegram + DB.
   * Dedup-ключ включает timestamp (с точностью до минуты) — позволяет тестировать
   * по одному разу в минуту без спама.
   */
  async sendTest(userId: string): Promise<{ queued: true }> {
    const minuteKey = new Date().toISOString().slice(0, 16); // "2026-05-29T12:34"
    await this.enqueue({
      type: NotificationType.LESSON_REMINDER,
      userId,
      title: '🔔 Тестовое уведомление',
      body:
        'Уведомления работают корректно! ✅\n\n' +
        'Это тест полного pipeline:\n' +
        '• BullMQ очередь → Processor → Telegram бот → БД',
      dedupKey: `notif:dedup:test:${userId}:${minuteKey}`,
      dedupTtlSec: 60,
      payload: { test: true },
    });
    return { queued: true };
  }

  // ─── Статусные уведомления ───────────────────────────────────────────────

  /** Зачисление подтверждено менеджером */
  async scheduleEnrollmentConfirmed(userId: string, classTitle: string, enrollmentId: string) {
    await this.enqueue({
      type: NotificationType.ENROLLMENT_CONFIRMED,
      userId,
      title: '✅ Запись подтверждена!',
      body: `Ваша запись в группу <b>${classTitle}</b> подтверждена менеджером.\n\nОткройте приложение чтобы увидеть расписание. 📅`,
      dedupKey: `notif:dedup:enrollment_confirmed:${enrollmentId}`,
      dedupTtlSec: DEDUP_TTL.ENROLLMENT_CONFIRMED,
      payload: { enrollmentId },
    });
  }

  /** Студент отчислен из группы */
  async scheduleEnrollmentDropped(userId: string, classTitle: string, enrollmentId: string) {
    await this.enqueue({
      type: NotificationType.ENROLLMENT_DROPPED,
      userId,
      title: '❌ Запись отменена',
      body: `Ваша запись в группу <b>${classTitle}</b> была отменена.\n\nЕсли это ошибка — обратитесь к менеджеру через раздел Поддержка.`,
      dedupKey: `notif:dedup:enrollment_dropped:${enrollmentId}`,
      dedupTtlSec: DEDUP_TTL.ENROLLMENT_DROPPED,
      payload: { enrollmentId },
    });
  }

  /** Пробный урок подтверждён */
  async scheduleTrialConfirmed(userId: string, languageName: string, trialId: string) {
    await this.enqueue({
      type: NotificationType.TRIAL_CONFIRMED,
      userId,
      title: '🎓 Пробный урок подтверждён!',
      body: `Ваша заявка на пробный урок по <b>${languageName}</b> подтверждена.\n\nМенеджер свяжется с вами в ближайшее время для уточнения времени. 🗓`,
      dedupKey: `notif:dedup:trial_confirmed:${trialId}`,
      dedupTtlSec: DEDUP_TTL.TRIAL_CONFIRMED,
      payload: { trialId },
    });
  }

  /** Пробный урок отменён */
  async scheduleTrialCancelled(userId: string, languageName: string, trialId: string) {
    await this.enqueue({
      type: NotificationType.TRIAL_CANCELLED,
      userId,
      title: '❌ Пробный урок отменён',
      body: `К сожалению, ваша заявка на пробный урок по <b>${languageName}</b> была отменена.\n\nВы можете оставить новую заявку в любое время.`,
      dedupKey: `notif:dedup:trial_cancelled:${trialId}`,
      dedupTtlSec: DEDUP_TTL.TRIAL_CANCELLED,
      payload: { trialId },
    });
  }

  /** Статус тикета поддержки изменён */
  async scheduleSupportTicketUpdated(
    userId: string,
    subject: string,
    newStatus: string,
    ticketId: string,
  ) {
    const statusLabel: Record<string, string> = {
      IN_PROGRESS: '🔄 В работе',
      CLOSED: '✅ Закрыт',
      OPEN: '🔴 Открыт',
    };
    await this.enqueue({
      type: NotificationType.SUPPORT_TICKET_UPDATED,
      userId,
      title: `${statusLabel[newStatus] ?? newStatus}: обращение обновлено`,
      body: `Тема: <b>${subject}</b>\nСтатус: ${statusLabel[newStatus] ?? newStatus}\n\nОткройте Поддержку в приложении для деталей.`,
      dedupKey: `notif:dedup:support_updated:${ticketId}:${newStatus}`,
      dedupTtlSec: DEDUP_TTL.SUPPORT_TICKET_UPDATED,
      payload: { ticketId },
    });
  }

  /** Сертификат выдан */
  async scheduleCertificateIssued(userId: string, classTitle: string, certId: string) {
    await this.enqueue({
      type: NotificationType.CERTIFICATE_ISSUED,
      userId,
      title: '🎓 Сертификат получен!',
      body: `Поздравляем! Вы завершили курс <b>${classTitle}</b> и получили сертификат.\n\nОткройте раздел «Сертификаты» в приложении чтобы скачать его. 🏆`,
      dedupKey: `notif:dedup:certificate_issued:${certId}`,
      dedupTtlSec: DEDUP_TTL.CERTIFICATE_ISSUED,
      payload: { certId },
    });
  }

  // ─── Заявки для персонала (MANAGER/ADMIN/SUPER_ADMIN) ────────────────────

  /**
   * Уведомляет весь персонал о новой заявке (пробный урок, открытие курса,
   * перевод, тикет, запись на курс). Вызывается fire-and-forget из сервисов.
   * dedupBase — уникальный префикс заявки (тип + id), к нему добавляется userId.
   */
  async notifyStaffNewRequest(title: string, body: string, dedupBase: string): Promise<void> {
    const staff = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN] },
        tg_blocked: false,
      },
      select: { id: true },
    });

    for (const s of staff) {
      await this.enqueue({
        type: NotificationType.STAFF_NEW_REQUEST,
        userId: s.id,
        title,
        body,
        dedupKey: `notif:dedup:staff_req:${dedupBase}:${s.id}`,
        dedupTtlSec: DEDUP_TTL.STAFF_NEW_REQUEST,
      });
    }
  }

  // ─── Универсальный метод ──────────────────────────────────────────────────

  /**
   * Универсальная отправка уведомления через BullMQ.
   * Предыдущий synchronous send() заменён на async через очередь.
   */
  async send(opts: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    dedupKey?: string;
    dedupTtlSec?: number;
    payload?: Record<string, unknown>;
  }): Promise<void> {
    await this.enqueue(opts);
  }

  // ─── REST API (read-only) ─────────────────────────────────────────────────

  /** Список уведомлений пользователя (последние 50) */
  async myNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }

  /** Отметить уведомление как прочитанное */
  async markRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, user_id: userId },
      data: { read_at: new Date() },
    });
  }

  /** Отметить все уведомления пользователя как прочитанные */
  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: new Date() },
    });
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  /**
   * Возвращает список parent_id для заданного child_id.
   * Если у студента нет привязанных родителей — пустой массив.
   */
  private async getParentsOf(childId: string): Promise<string[]> {
    const links = await this.prisma.parentChildLink.findMany({
      where: { child_id: childId },
      select: { parent_id: true },
    });
    return links.map((l) => l.parent_id);
  }

  /**
   * Добавляет задание в BullMQ очередь.
   * @param data  — данные уведомления
   * @param opts  — опции BullMQ (delay для напоминаний)
   */
  private async enqueue(data: NotificationJobData, opts: { delay?: number } = {}): Promise<void> {
    try {
      await this.queue.add('send', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        delay: opts.delay,
      });
    } catch (err) {
      // Не пробрасываем — сбой очереди не должен ломать основной флоу
      this.logger.error(`Failed to enqueue notification: ${String(err)}`);
    }
  }
}
