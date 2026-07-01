import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { FiscalService } from '../../fiscal/fiscal.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaymentsService } from '../payments.service';
import { ClickPrepareDto } from './dto/click-prepare.dto';
import { ClickCompleteDto } from './dto/click-complete.dto';

/**
 * Click Prepare + Complete webhook handler.
 * Документация: https://docs.click.uz/
 *
 * Две стадии:
 *  1. Prepare   — проверяем заказ, отвечаем {click_trans_id, merchant_trans_id, error, error_note}
 *  2. Complete  — подтверждаем/отменяем, обновляем статус Payment
 */
@Injectable()
export class ClickService {
  private readonly logger = new Logger(ClickService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly fiscal: FiscalService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
  ) {}

  // ─── Prepare ──────────────────────────────────────────────────────────────

  async prepare(body: ClickPrepareDto) {
    const {
      click_trans_id,
      service_id,
      click_paydoc_id,
      merchant_trans_id,
      amount,
      action,
      error,
      error_note,
      sign_time,
      sign_string,
    } = body;

    // Проверяем подпись
    if (
      !this.verifySign(
        {
          click_trans_id,
          service_id,
          click_paydoc_id,
          merchant_trans_id,
          amount,
          action,
          sign_time,
          sign_string,
        },
        null,
      )
    ) {
      return this.clickError(click_trans_id, merchant_trans_id, -1, 'Invalid sign');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { idempotency_key: merchant_trans_id },
    });

    if (!payment) {
      return this.clickError(click_trans_id, merchant_trans_id, -5, 'Order not found');
    }

    if (payment.status === PaymentStatus.PAID) {
      return this.clickError(click_trans_id, merchant_trans_id, -4, 'Already paid');
    }

    if (payment.status === PaymentStatus.CANCELLED) {
      return this.clickError(click_trans_id, merchant_trans_id, -9, 'Order cancelled');
    }

    // Проверяем сумму (Click шлёт в сумах, payment хранит в тийинах)
    if (!this.amountMatches(amount, payment.amount_tiyin)) {
      return this.clickError(click_trans_id, merchant_trans_id, -2, 'Invalid amount');
    }

    // Обновляем provider_txn_id
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        provider_txn_id: click_trans_id,
        status: PaymentStatus.AUTHORIZED,
        payload_in: body as object,
      },
    });

    await this.logWebhook(click_trans_id, payment.id, body as unknown as Record<string, unknown>);

    return { click_trans_id, merchant_trans_id, error: 0, error_note: 'Success' };
  }

  // ─── Complete ─────────────────────────────────────────────────────────────

  async complete(body: ClickCompleteDto) {
    const {
      click_trans_id,
      service_id,
      click_paydoc_id,
      merchant_trans_id,
      amount,
      action,
      error,
      error_note,
      sign_time,
      sign_string,
      merchant_prepare_id,
    } = body;

    if (
      !this.verifySign(
        {
          click_trans_id,
          service_id,
          click_paydoc_id,
          merchant_trans_id,
          amount,
          action,
          sign_time,
          sign_string,
        },
        merchant_prepare_id ?? null,
      )
    ) {
      return this.clickError(click_trans_id, merchant_trans_id, -1, 'Invalid sign');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { idempotency_key: merchant_trans_id },
    });

    if (!payment) {
      return this.clickError(click_trans_id, merchant_trans_id, -5, 'Order not found');
    }

    // Уже оплачен — идемпотентно
    if (payment.status === PaymentStatus.PAID) {
      return { click_trans_id, merchant_trans_id, error: 0, error_note: 'Success' };
    }

    // Проверяем сумму ещё раз (defense — complete может прийти без prepare)
    if (!this.amountMatches(amount, payment.amount_tiyin)) {
      return this.clickError(click_trans_id, merchant_trans_id, -2, 'Invalid amount');
    }

    const clickError = parseInt(String(error), 10);

    if (clickError < 0) {
      // Click сообщает об ошибке — отменяем
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CANCELLED, payload_out: body as object },
      });
      return this.clickError(click_trans_id, merchant_trans_id, clickError, error_note);
    }

    // Успешная оплата
    const paidAt = new Date();
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paid_at: paidAt,
        payload_out: body as object,
      },
    });

    // Активируем запись/пробный + TG-инвайт + Zoom (fire-and-forget)
    void this.payments.handlePaidPayment(payment.id);

    // Фискализация (fire-and-forget)
    void this.fiscal.scheduleReceipt(payment.id);

    // Уведомление об успешной оплате (fire-and-forget)
    void this.notifications.schedulePaymentConfirmed(
      payment.id,
      payment.user_id,
      payment.amount_tiyin,
    );

    await this.logWebhook(click_trans_id, payment.id, body as unknown as Record<string, unknown>);

    return { click_trans_id, merchant_trans_id, error: 0, error_note: 'Success' };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private verifySign(
    params: {
      click_trans_id: string;
      service_id: string;
      click_paydoc_id: string;
      merchant_trans_id: string;
      amount: string;
      action: string;
      sign_time: string;
      sign_string: string;
    },
    merchantPrepareId: string | null,
  ): boolean {
    const secretKey = this.config.get<string>('CLICK_SECRET_KEY') ?? '';
    if (!secretKey) {
      // Fail-closed: без ключа подпись не проверить → отклоняем все webhooks.
      // Принимать неподписанный платёж = дыра (любой POST помечает PAID).
      this.logger.error('CLICK_SECRET_KEY not set — rejecting webhook (cannot verify signature)');
      return false;
    }

    const prepareId = merchantPrepareId ?? '';
    const raw =
      params.click_trans_id +
      params.service_id +
      secretKey +
      params.merchant_trans_id +
      (prepareId ? prepareId + secretKey : '') +
      params.amount +
      params.action +
      params.sign_time;

    const expected = createHash('md5').update(raw).digest('hex');
    // Сравнение за постоянное время — защита от timing-атак на подпись.
    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(params.sign_string ?? '', 'utf8');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  }

  /**
   * Сверяет сумму из Click (сумы, строка) с payment.amount_tiyin (тийины).
   * Допуск 0.01 сум на float-погрешность.
   */
  private amountMatches(clickAmountSum: string, amountTiyin: bigint): boolean {
    const expectedSum = Number(amountTiyin) / 100;
    const gotSum = parseFloat(clickAmountSum);
    if (isNaN(gotSum)) return false;
    return Math.abs(gotSum - expectedSum) < 0.01;
  }

  private clickError(clickTransId: string, merchantTransId: string, code: number, note: string) {
    return {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: code,
      error_note: note,
    };
  }

  private async logWebhook(
    externalId: string,
    paymentId: string,
    rawBody: Record<string, unknown>,
  ) {
    try {
      await this.prisma.webhookEvent.upsert({
        where: {
          provider_external_id: { provider: PaymentProvider.CLICK, external_id: externalId },
        },
        create: {
          provider: PaymentProvider.CLICK,
          external_id: externalId,
          payment_id: paymentId,
          raw_body: rawBody as object,
          processed: true,
          processed_at: new Date(),
        },
        update: { processed: true, processed_at: new Date() },
      });
    } catch {
      /* non-critical */
    }
  }
}
