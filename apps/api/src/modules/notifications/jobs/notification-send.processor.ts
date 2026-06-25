import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../redis/redis.service';
import { TelegramService } from '../../telegram/telegram.service';
import { NOTIFICATIONS_QUEUE, NotificationJobData } from '../notification.types';

/**
 * NotificationSendProcessor — BullMQ-воркер для отправки уведомлений.
 *
 * Алгоритм process():
 *  1. Проверяем dedup-ключ в Redis — если уже установлен, пропускаем.
 *  2. Получаем telegram_user_id пользователя. Если tg_blocked — пропускаем.
 *  3. Создаём запись Notification в БД (лог).
 *  4. Отправляем HTML-сообщение через TelegramService.sendMessage().
 *  5. Обновляем sent_at.
 *  6. Устанавливаем dedup-ключ в Redis (SETEX) чтобы не отправить дубль.
 *
 * На ошибку: бросаем Error → BullMQ планирует retry (3 попытки, exponential 5s).
 * TelegramService.sendMessage() уже поглощает TG-ошибки (пользователь заблокировал бота).
 * Prisma-ошибки пробрасываются → retry.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationSendProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationSendProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly telegram: TelegramService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { type, userId, title, body, dedupKey, dedupTtlSec, payload } = job.data;

    this.logger.debug(`Notification job #${job.id}: type=${type} user=${userId}`);

    // ── 1. Dedup-проверка ─────────────────────────────────────────────────────
    if (dedupKey) {
      const exists = await this.redis.get(dedupKey);
      if (exists) {
        this.logger.debug(`Duplicate skipped: ${dedupKey}`);
        return;
      }
    }

    // ── 2. Получаем пользователя ──────────────────────────────────────────────
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegram_user_id: true, tg_blocked: true },
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found — skip notification`);
      return;
    }

    if (user.tg_blocked) {
      this.logger.debug(`User ${userId} has tg_blocked — skip notification`);
      return;
    }

    // ── 3. Создаём запись в БД ────────────────────────────────────────────────
    const notif = await this.prisma.notification.create({
      data: {
        user_id: userId,
        type,
        title,
        body,
        payload: (payload ?? {}) as object,
      },
    });

    // ── 4. Отправляем в Telegram ──────────────────────────────────────────────
    // Передаём telegram_user_id как string чтобы избежать потери точности:
    // Number(BigInt) теряет точность для ID > 2^53-1.
    // TelegramService.sendMessage() принимает number, но внутри вызывает .toString() →
    // меняем сигнатуру через typecast на число внутри безопасного диапазона,
    // а для ID которые выходят за пределы — grammY принимает string напрямую.
    const html = `<b>${title}</b>\n\n${body}`;
    await this.telegram.sendMessageStr(user.telegram_user_id.toString(), html);

    // ── 5. Обновляем sent_at ──────────────────────────────────────────────────
    await this.prisma.notification.update({
      where: { id: notif.id },
      data: { sent_at: new Date() },
    });

    // ── 6. Устанавливаем dedup-ключ ───────────────────────────────────────────
    if (dedupKey && dedupTtlSec) {
      await this.redis.setex(dedupKey, dedupTtlSec, '1');
    }

    this.logger.log(`Notification sent: type=${type} user=${userId}`);
  }
}
