import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FiscalStatus, PaymentStatus, ReceiptType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { FISCAL_QUEUE, FiscalJobData } from './jobs/fiscal-send.processor';

/**
 * FiscalService — оркестратор фискализации.
 *
 * Ответственности:
 *  - Создать запись FiscalReceipt при успешной оплате.
 *  - Поставить задание в очередь BullMQ `fiscal-send`.
 *  - Предоставить REST-эндпоинты: GET /fiscal/receipt/:id, POST /fiscal/receipt/:id/retry.
 *
 * Правила:
 *  - scheduleReceipt() вызывается из PaymeService/ClickService после PaymentStatus.PAID.
 *  - scheduleRefundReceipt() вызывается из PaymentsService.adminRefund().
 *  - Оба метода idempotent: если FiscalReceipt уже существует — пропускают.
 */
@Injectable()
export class FiscalService {
  private readonly logger = new Logger(FiscalService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(FISCAL_QUEUE) private readonly fiscalQueue: Queue<FiscalJobData>,
  ) {}

  // ─── Планирование ────────────────────────────────────────────────────────

  /**
   * Создать FiscalReceipt (SALE) и поставить в очередь.
   * Вызывается fire-and-forget после payment.paid.
   */
  async scheduleReceipt(paymentId: string): Promise<void> {
    await this.enqueue(paymentId, 'SALE');
  }

  /**
   * Создать FiscalReceipt (REFUND) и поставить в очередь.
   * Вызывается после adminRefund().
   */
  async scheduleRefundReceipt(paymentId: string): Promise<void> {
    await this.enqueue(paymentId, 'REFUND');
  }

  // ─── REST API ─────────────────────────────────────────────────────────────

  /**
   * GET /fiscal/receipt/:id
   * Возвращает FiscalReceipt по ID или по payment_id.
   */
  async getReceipt(receiptId: string) {
    const receipt = await this.prisma.fiscalReceipt.findUnique({
      where: { id: receiptId },
      include: { payment: { select: { id: true, status: true, amount_tiyin: true } } },
    });

    if (!receipt) throw new NotFoundException('Fiscal receipt not found');

    return this.serializeReceipt(receipt);
  }

  /**
   * GET /fiscal/receipt/by-payment/:paymentId
   * Возвращает чек по ID платежа.
   */
  async getReceiptByPayment(paymentId: string) {
    const receipt = await this.prisma.fiscalReceipt.findUnique({
      where: { payment_id: paymentId },
      include: { payment: { select: { id: true, status: true, amount_tiyin: true } } },
    });

    if (!receipt) throw new NotFoundException('Fiscal receipt not found for this payment');

    return this.serializeReceipt(receipt);
  }

  /**
   * POST /fiscal/receipt/:id/retry  (ADMIN+)
   * Ретрай для чека в статусе FAILED.
   */
  async retryReceipt(receiptId: string) {
    const receipt = await this.prisma.fiscalReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) throw new NotFoundException('Fiscal receipt not found');

    if (receipt.status === FiscalStatus.CONFIRMED || receipt.status === FiscalStatus.REFUNDED) {
      throw new BadRequestException(
        `Cannot retry receipt in status ${receipt.status} — already completed`,
      );
    }

    // Сбрасываем статус на PENDING, кладём в очередь без задержки
    await this.prisma.fiscalReceipt.update({
      where: { id: receiptId },
      data: { status: FiscalStatus.PENDING, last_error: null },
    });

    const receiptType: 'SALE' | 'REFUND' =
      receipt.receipt_type === ReceiptType.REFUND ? 'REFUND' : 'SALE';

    await this.fiscalQueue.add(
      'send',
      { paymentId: receipt.payment_id, receiptType },
      {
        jobId: `retry-${receiptId}-${Date.now()}`,
        attempts: 6,
        backoff: { type: 'custom' },
      },
    );

    this.logger.log(`FiscalReceipt ${receiptId} manually re-queued by admin`);

    return { ok: true, receipt_id: receiptId, status: FiscalStatus.PENDING };
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async enqueue(paymentId: string, receiptType: 'SALE' | 'REFUND'): Promise<void> {
    // Загружаем Payment для получения суммы
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      this.logger.warn(`enqueue: Payment ${paymentId} not found`);
      return;
    }

    // Проверяем статус
    const allowedStatuses: PaymentStatus[] = [PaymentStatus.PAID, PaymentStatus.REFUNDED];
    if (!allowedStatuses.includes(payment.status)) {
      this.logger.warn(`enqueue: Payment ${paymentId} in status ${payment.status} — skip fiscal`);
      return;
    }

    // Idempotency: если FiscalReceipt уже существует с нужным типом — не дублируем
    const existing = await this.prisma.fiscalReceipt.findUnique({
      where: { payment_id: paymentId },
    });

    if (existing) {
      // Если CONFIRMED/REFUNDED — всё хорошо, не создаём новый
      if (existing.status === FiscalStatus.CONFIRMED || existing.status === FiscalStatus.REFUNDED) {
        this.logger.debug(`FiscalReceipt for payment ${paymentId} already completed — skip`);
        return;
      }
      // FAILED — ставим в очередь повторно (manual retry через enqueue)
      this.logger.log(
        `FiscalReceipt for payment ${paymentId} exists in ${existing.status} — re-enqueue`,
      );
    } else {
      // Создаём FiscalReceipt
      const prismaReceiptType = receiptType === 'REFUND' ? ReceiptType.REFUND : ReceiptType.SALE;

      await this.prisma.fiscalReceipt.create({
        data: {
          payment_id: paymentId,
          status: FiscalStatus.PENDING,
          receipt_type: prismaReceiptType,
          total_tiyin: payment.amount_tiyin,
          vat_tiyin: payment.vat_amount_tiyin,
          items: [],
          attempts: 0,
        },
      });

      this.logger.log(`FiscalReceipt created for payment ${paymentId} (${receiptType})`);
    }

    // Кладём в очередь BullMQ
    const jobData: FiscalJobData = { paymentId, receiptType };
    const jobId = `fiscal-${paymentId}-${receiptType}`;

    await this.fiscalQueue.add('send', jobData, {
      jobId, // уникальный ID предотвращает дубли
      attempts: 6,
      backoff: { type: 'custom' },
    });

    this.logger.log(`Fiscal job enqueued: jobId=${jobId}`);
  }

  /** BigInt-safe сериализация */
  private serializeReceipt(
    receipt: Awaited<ReturnType<typeof this.prisma.fiscalReceipt.findUnique>> & {
      payment?: { id: string; status: string; amount_tiyin: bigint } | null;
    },
  ) {
    if (!receipt) return null;
    return {
      ...receipt,
      total_tiyin: receipt.total_tiyin.toString(),
      vat_tiyin: receipt.vat_tiyin.toString(),
      payment: receipt.payment
        ? {
            ...receipt.payment,
            amount_tiyin: receipt.payment.amount_tiyin.toString(),
          }
        : undefined,
    };
  }
}
