import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FiscalStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { SoliqClient } from '../soliq/soliq.client';
import { FiscalReceiptBuilder } from '../fiscal-receipt.builder';
import { NotificationsService } from '../../notifications/notifications.service';

export const FISCAL_QUEUE = 'fiscal-send';

/** Данные задания в очереди */
export interface FiscalJobData {
  paymentId: string;
  receiptType: 'SALE' | 'REFUND';
}

/**
 * Задержки повторных попыток (custom backoff).
 * Индекс 0 = после 1-й неудачи, индекс 1 = после 2-й, и т.д.
 *
 * По плану: 1м → 5м → 30м → 2ч → 12ч → 24ч
 */
export const RETRY_DELAYS_MS = [
  60_000, // 1 мин
  300_000, // 5 мин
  1_800_000, // 30 мин
  7_200_000, // 2 ч
  43_200_000, // 12 ч
  86_400_000, // 24 ч
];

/**
 * FiscalSendProcessor — BullMQ worker для отправки фискальных чеков в Soliq OFD.
 *
 * Backoff стратегия: RETRY_DELAYS_MS (custom), задаётся в @Processor options.
 * BullMQ вызывает backoffStrategy(attemptsMade) при каждом провале.
 * attemptsMade = 1 после первой неудачи, 2 после второй, и т.д.
 *
 * Алгоритм process():
 *  1. Загружаем Payment + FiscalReceipt.
 *  2. Инкрементируем attempts.
 *  3. Строим запрос через FiscalReceiptBuilder.
 *  4. Отправляем через SoliqClient.
 *  5. Успех → CONFIRMED/REFUNDED + сохраняем fiscal_sign.
 *  6. Ошибка → FAILED + last_error → throw → BullMQ планирует retry.
 */
@Processor(FISCAL_QUEUE, {
  settings: {
    backoffStrategy: (attemptsMade: number): number => {
      const last = RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1] as number;
      return RETRY_DELAYS_MS[attemptsMade - 1] ?? last;
    },
  },
})
export class FiscalSendProcessor extends WorkerHost {
  private readonly logger = new Logger(FiscalSendProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly soliq: SoliqClient,
    private readonly builder: FiscalReceiptBuilder,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  /**
   * После исчерпания всех попыток — алертим персонал (MANAGER/ADMIN/SUPER_ADMIN),
   * что чек не ушёл в Soliq (иначе провал был бы «тихим»).
   */
  @OnWorkerEvent('failed')
  async onFailed(job: Job<FiscalJobData>): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) return; // ещё будут ретраи

    void this.notifications.notifyStaffNewRequest(
      '⚠️ Фискальный чек не отправлен',
      `Платёж ${job.data.paymentId}: чек не ушёл в Soliq после ${maxAttempts} попыток. ` +
        `Проверьте интеграцию ОФД и сделайте retry в /admin.`,
      `fiscal_failed:${job.data.paymentId}`,
    );
    this.logger.error(
      `Fiscal job for payment ${job.data.paymentId} exhausted ${maxAttempts} attempts — staff alerted`,
    );
  }

  async process(job: Job<FiscalJobData>): Promise<void> {
    const { paymentId, receiptType } = job.data;

    this.logger.log(
      `Processing fiscal job #${job.id}: payment=${paymentId} ` +
        `type=${receiptType} attempt=${job.attemptsMade + 1}`,
    );

    // ── 1. Загружаем Payment ─────────────────────────────────────────────────
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { class: { select: { title: true } } },
    });

    if (!payment) {
      this.logger.warn(`Payment ${paymentId} not found — discarding job`);
      return; // не бросаем ошибку — нет смысла ретраить
    }

    // ── 2. Загружаем FiscalReceipt ────────────────────────────────────────────
    const receipt = await this.prisma.fiscalReceipt.findUnique({
      where: { payment_id: paymentId },
    });

    if (!receipt) {
      this.logger.warn(`FiscalReceipt for payment ${paymentId} not found — skip`);
      return;
    }

    // Идемпотентность — уже завершён
    if (receipt.status === FiscalStatus.CONFIRMED || receipt.status === FiscalStatus.REFUNDED) {
      this.logger.log(`FiscalReceipt ${receipt.id} already ${receipt.status} — skip`);
      return;
    }

    // ── 3. Инкрементируем attempts ────────────────────────────────────────────
    await this.prisma.fiscalReceipt.update({
      where: { id: receipt.id },
      data: { attempts: { increment: 1 } },
    });

    // ── 4. Строим и отправляем чек ────────────────────────────────────────────
    const reqBody =
      receiptType === 'REFUND'
        ? this.builder.buildRefund(payment)
        : this.builder.buildSale(payment);

    try {
      const resp = await this.soliq.sendReceipt(reqBody);

      // ── 5a. Успех ──────────────────────────────────────────────────────────
      const newStatus = receiptType === 'REFUND' ? FiscalStatus.REFUNDED : FiscalStatus.CONFIRMED;

      await this.prisma.fiscalReceipt.update({
        where: { id: receipt.id },
        data: {
          status: newStatus,
          fiscal_sign: resp.fiscalSign ?? null,
          fiscal_number: resp.receiptId ?? null,
          receipt_url: resp.receiptUrl ?? null,
          response_payload: resp as object,
          sent_at: new Date(),
          last_error: null,
        },
      });

      this.logger.log(
        `FiscalReceipt ${receipt.id} → ${newStatus} (receiptId=${resp.receiptId ?? 'sandbox'})`,
      );
    } catch (err) {
      // ── 5b. Ошибка → retry ─────────────────────────────────────────────────
      const errorMsg = String(err);

      await this.prisma.fiscalReceipt.update({
        where: { id: receipt.id },
        data: { status: FiscalStatus.FAILED, last_error: errorMsg },
      });

      this.logger.error(
        `FiscalReceipt ${receipt.id} FAILED (attempt=${job.attemptsMade + 1}): ${errorMsg}`,
      );

      // Бросаем — BullMQ поймает и запланирует следующую попытку
      throw err instanceof Error ? err : new Error(errorMsg);
    }
  }
}
