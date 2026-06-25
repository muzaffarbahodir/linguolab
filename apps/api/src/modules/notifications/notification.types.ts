/**
 * Типы и интерфейсы для системы уведомлений (BullMQ).
 *
 * Все уведомления проходят через очередь `notifications`:
 *  1. NotificationsService.schedule*() → добавляет job в BullMQ
 *  2. NotificationSendProcessor.process() → отправляет через TelegramService
 *
 * Деdup: Redis SETEX — если ключ уже установлен, job пропускается.
 * Retry: 3 попытки, exponential backoff (5с → 25с → 125с).
 */

export const NOTIFICATIONS_QUEUE = 'notifications';

// ─── Типы уведомлений ─────────────────────────────────────────────────────────

export enum NotificationType {
  /** Оплата успешно прошла */
  PAYMENT_CONFIRMED = 'payment_confirmed',
  /** Возврат средств */
  PAYMENT_REFUNDED = 'payment_refunded',
  /** Напоминание о занятии за 1 час */
  LESSON_REMINDER = 'lesson_reminder',
  /** Новое домашнее задание */
  HOMEWORK_NEW = 'homework_new',
  /** Преподаватель оценил ДЗ */
  GRADE_RECEIVED = 'grade_received',
  // ─── Родительские ─────────────────────────────────────────────────────────
  /** Ребёнок отсутствовал на занятии */
  PARENT_CHILD_ABSENT = 'parent_child_absent',
  /** Новое ДЗ у ребёнка */
  PARENT_CHILD_HOMEWORK_NEW = 'parent_child_homework_new',
  /** Оценка за ДЗ ребёнка */
  PARENT_CHILD_GRADE_RECEIVED = 'parent_child_grade_received',
  // ─── Onboarding + Retention ───────────────────────────────────────────────
  /** Приветственное сообщение новому пользователю */
  WELCOME = 'welcome',
  /** Напоминание неактивному студенту вернуться в приложение */
  RETENTION_REMINDER = 'retention_reminder',
  /** Напоминание о просроченных домашних заданиях */
  HOMEWORK_OVERDUE = 'homework_overdue',
  // ─── Административные ─────────────────────────────────────────────────────
  /** Массовая рассылка от менеджера/администратора */
  BROADCAST = 'broadcast',
  /** Новая заявка — менеджерам/админам (пробный, курс, перевод, тикет, запись) */
  STAFF_NEW_REQUEST = 'staff_new_request',
  // ─── Статусные ────────────────────────────────────────────────────────────
  /** Зачисление подтверждено менеджером */
  ENROLLMENT_CONFIRMED = 'enrollment_confirmed',
  /** Зачисление отклонено / отчислен */
  ENROLLMENT_DROPPED = 'enrollment_dropped',
  /** Пробный урок подтверждён */
  TRIAL_CONFIRMED = 'trial_confirmed',
  /** Пробный урок отменён */
  TRIAL_CANCELLED = 'trial_cancelled',
  /** Тикет поддержки обновлён */
  SUPPORT_TICKET_UPDATED = 'support_ticket_updated',
  /** Сертификат выдан */
  CERTIFICATE_ISSUED = 'certificate_issued',
}

// ─── Данные задания в очереди ─────────────────────────────────────────────────

export interface NotificationJobData {
  /** Тип уведомления */
  type: NotificationType;
  /** ID пользователя (Prisma User.id) */
  userId: string;
  /** Заголовок уведомления */
  title: string;
  /** Текст уведомления */
  body: string;
  /**
   * Redis-ключ для дедупликации.
   * Если ключ уже существует — job пропускается (не отправляем дубль).
   * Пример: `notif:dedup:payment_confirmed:{paymentId}`
   */
  dedupKey?: string;
  /** TTL для dedup-ключа в Redis (секунды) */
  dedupTtlSec?: number;
  /** Дополнительные данные для deep-link / логики */
  payload?: Record<string, unknown>;
}

// ─── TTL для дедупликации (секунды) ──────────────────────────────────────────

export const DEDUP_TTL = {
  PAYMENT_CONFIRMED: 86_400, // 24ч — оплата уникальна по paymentId
  PAYMENT_REFUNDED: 86_400, // 24ч
  LESSON_REMINDER: 7_200, // 2ч — на случай повторного триггера
  HOMEWORK_NEW: 86_400, // 24ч
  GRADE_RECEIVED: 3_600, // 1ч
  // Родительские
  PARENT_CHILD_ABSENT: 86_400, // 24ч — один раз за урок
  PARENT_CHILD_HOMEWORK_NEW: 86_400, // 24ч
  PARENT_CHILD_GRADE_RECEIVED: 86_400, // 24ч
  // Onboarding + Retention
  WELCOME: 31_536_000, // 1 год — один раз за жизнь аккаунта (dedup по userId)
  RETENTION_REMINDER: 86_400, // 24ч — не спамим если уже отправили сегодня
  HOMEWORK_OVERDUE: 43_200, // 12ч — один раз в полдня
  // Статусные
  ENROLLMENT_CONFIRMED: 86_400,
  ENROLLMENT_DROPPED: 86_400,
  TRIAL_CONFIRMED: 86_400,
  TRIAL_CANCELLED: 86_400,
  SUPPORT_TICKET_UPDATED: 3_600,
  CERTIFICATE_ISSUED: 86_400 * 30, // 30 дней — сертификат выдаётся один раз
  STAFF_NEW_REQUEST: 86_400, // 24ч — одна заявка = одно уведомление staff
} as const;

// ─── Имя очереди для retention-джобов ─────────────────────────────────────────

export const RETENTION_QUEUE = 'retention';
