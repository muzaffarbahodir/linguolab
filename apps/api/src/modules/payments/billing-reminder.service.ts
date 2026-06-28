import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';

/**
 * BillingReminderService — авто-напоминания об оплате обучения.
 *
 * Раз в день проверяет активные записи и шлёт студенту напоминание, если
 * оплаченный период скоро истекает (≤3 дней) или уже просрочен (до 7 дней назад).
 * Окна ограничивают число сообщений (без поля last_reminder_at).
 */
@Injectable()
export class BillingReminderService {
  private readonly logger = new Logger(BillingReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  /** Каждый день в 09:00 (UTC). */
  @Cron('0 9 * * *')
  async tick(): Promise<void> {
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    const overdueFloor = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

    const due = await this.prisma.enrollment.findMany({
      where: {
        status: 'ACTIVE',
        is_trial: false,
        paid_until: { not: null, gte: overdueFloor, lte: soon },
      },
      select: {
        paid_until: true,
        student: { select: { telegram_user_id: true } },
        class: { select: { title: true, price_uzs: true } },
      },
    });

    let sent = 0;
    for (const e of due) {
      if (!e.paid_until || !e.student.telegram_user_id) continue;
      const overdue = e.paid_until < now;
      const dateStr = e.paid_until.toLocaleDateString('ru-RU');
      const msg = overdue
        ? `⚠️ <b>${e.class.title}</b>\n\nОплата за обучение просрочена (с ${dateStr}).` +
          `\nПродлите доступ в разделе «Расписание».`
        : `🔔 <b>${e.class.title}</b>\n\nОплачено до <b>${dateStr}</b>.` +
          `\nПродлите обучение, чтобы не потерять доступ.`;
      try {
        await this.telegram.sendMessageStr(e.student.telegram_user_id.toString(), msg);
        sent++;
      } catch (err) {
        this.logger.warn(`reminder failed: ${String(err)}`);
      }
    }
    if (sent > 0) this.logger.log(`Billing reminders sent: ${sent}`);
  }
}
