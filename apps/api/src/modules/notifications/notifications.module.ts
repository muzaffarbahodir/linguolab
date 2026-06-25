import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationSendProcessor } from './jobs/notification-send.processor';
import { RetentionProcessor } from './jobs/retention.processor';
import { NOTIFICATIONS_QUEUE, RETENTION_QUEUE } from './notification.types';

@Module({
  imports: [
    // Очередь `notifications` — отправка уведомлений (3 попытки, exp backoff)
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    }),
    // Очередь `retention` — ежедневные retention-кампании (cron repeatable jobs)
    BullModule.registerQueue({
      name: RETENTION_QUEUE,
      defaultJobOptions: {
        attempts: 1, // cron-задания не нужно ретраить — следующее придёт завтра
        removeOnComplete: { count: 10 },
        removeOnFail: { count: 30 },
      },
    }),
    TelegramModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationSendProcessor, RetentionProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit {
  private readonly logger = new Logger(NotificationsModule.name);

  constructor(@InjectQueue(RETENTION_QUEUE) private readonly retentionQueue: Queue) {}

  /**
   * При старте модуля регистрируем repeatable BullMQ jobs (cron).
   * BullMQ сам отслеживает что job уже зарегистрирован — повторная регистрация
   * с теми же параметрами обновляет расписание без дублирования.
   *
   * Расписание (UTC):
   *  - inactive_students: 10:00 UTC = 15:00 UTC+5 (пик активности, рабочий день)
   *  - homework_overdue:  07:00 UTC = 12:00 UTC+5 (обед, напоминание после полудня)
   */
  async onModuleInit(): Promise<void> {
    await this.retentionQueue.add(
      'retention',
      { campaign: 'inactive_students' },
      {
        repeat: { pattern: '0 10 * * *' }, // ежедневно в 10:00 UTC
        jobId: 'retention-inactive-students', // стабильный ID — нет дублей
      },
    );

    await this.retentionQueue.add(
      'retention',
      { campaign: 'homework_overdue' },
      {
        repeat: { pattern: '0 7 * * *' }, // ежедневно в 07:00 UTC
        jobId: 'retention-homework-overdue',
      },
    );

    this.logger.log('Retention cron jobs registered: inactive_students + homework_overdue');
  }
}
