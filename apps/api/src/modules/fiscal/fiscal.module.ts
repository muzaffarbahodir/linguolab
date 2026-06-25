import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { NotificationsModule } from '../notifications/notifications.module';
import { FiscalService } from './fiscal.service';
import { FiscalController } from './fiscal.controller';
import { FiscalSendProcessor, FISCAL_QUEUE } from './jobs/fiscal-send.processor';
import { FiscalReceiptBuilder } from './fiscal-receipt.builder';
import { SoliqAuthService } from './soliq/soliq-auth.service';
import { SoliqClient } from './soliq/soliq.client';

/**
 * FiscalModule — модуль фискализации (Soliq OFD).
 *
 * Зависимости:
 *  - PrismaService (@Global — не нужен явный импорт)
 *  - ConfigService (@Global — не нужен явный импорт)
 *  - BullMQ Redis-подключение регистрируется в AppModule через BullModule.forRootAsync
 *
 * Экспортирует FiscalService → используется в PaymentsModule:
 *  - scheduleReceipt(paymentId)       — после PAID
 *  - scheduleRefundReceipt(paymentId) — после adminRefund()
 */
@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({
      name: FISCAL_QUEUE,
      defaultJobOptions: {
        attempts: 6,
        // Custom backoff: функция задана в @Processor decorator на FiscalSendProcessor
        backoff: { type: 'custom' },
        // Хранить завершённые задания для аудита
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    }),
  ],
  controllers: [FiscalController],
  providers: [
    SoliqAuthService,
    SoliqClient,
    FiscalReceiptBuilder,
    FiscalSendProcessor, // WorkerHost — NestJS BullMQ подхватывает @Processor автоматически
    FiscalService,
  ],
  exports: [FiscalService],
})
export class FiscalModule {}
