import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, PaymentProvider } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { FiscalService } from '../../fiscal/fiscal.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaymentsService } from '../payments.service';
import {
  PaymeRpcRequest,
  PaymeRpcResponse,
  PaymeState,
  PaymeCancelReason,
  PaymeError,
  paymeError,
  paymeResult,
} from './payme.types';

/** Максимальный срок транзакции Payme — 12 часов в мс */
const PAYME_TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class PaymeService {
  private readonly logger = new Logger(PaymeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly fiscal: FiscalService,
    private readonly notifications: NotificationsService,
    private readonly payments: PaymentsService,
  ) {}

  /** Точка входа: роутим JSON-RPC метод */
  async handle(req: PaymeRpcRequest): Promise<PaymeRpcResponse> {
    const { id, method, params } = req;

    this.logger.debug(`Payme RPC: ${method}`);

    try {
      switch (method) {
        case 'CheckPerformTransaction':
          return this.checkPerformTransaction(id, params);
        case 'CreateTransaction':
          return this.createTransaction(id, params);
        case 'PerformTransaction':
          return this.performTransaction(id, params);
        case 'CancelTransaction':
          return this.cancelTransaction(id, params);
        case 'CheckTransaction':
          return this.checkTransaction(id, params);
        case 'GetStatement':
          return this.getStatement(id, params);
        default:
          return paymeError(id, PaymeError.METHOD_NOT_FOUND, 'Method not found');
      }
    } catch (err) {
      this.logger.error(`Payme handler error: ${String(err)}`);
      return paymeError(id, PaymeError.INTERNAL_ERROR, 'Internal error');
    }
  }

  // ─── CheckPerformTransaction ────────────────────────────────────────────────
  // Payme спрашивает: можно ли провести платёж?
  // Проверяем: сумма, существует ли payment-запись (idempotency_key = account.order_id)

  private async checkPerformTransaction(
    id: number | string,
    params: Record<string, unknown>,
  ): Promise<PaymeRpcResponse> {
    const { amount, account } = params as { amount: number; account: { order_id: string } };

    if (!account?.order_id) {
      return paymeError(id, PaymeError.INVALID_PARAMS, 'account.order_id is required');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { idempotency_key: account.order_id },
    });

    if (!payment) {
      return paymeError(id, PaymeError.ORDER_NOT_FOUND, 'Order not found');
    }

    if (payment.status === PaymentStatus.PAID) {
      return paymeError(id, PaymeError.ORDER_ALREADY_PAID, 'Order already paid');
    }

    if (payment.status === PaymentStatus.CANCELLED) {
      return paymeError(id, PaymeError.UNABLE_TO_PERFORM, 'Order cancelled');
    }

    // Проверяем сумму (Payme передаёт в тийинах)
    if (BigInt(amount) !== payment.amount_tiyin) {
      return paymeError(id, PaymeError.INVALID_AMOUNT, 'Invalid amount', {
        expected: payment.amount_tiyin.toString(),
        got: amount,
      });
    }

    return paymeResult(id, { allow: true });
  }

  // ─── CreateTransaction ───────────────────────────────────────────────────────

  private async createTransaction(
    id: number | string,
    params: Record<string, unknown>,
  ): Promise<PaymeRpcResponse> {
    const {
      id: txnId,
      time,
      amount,
      account,
    } = params as {
      id: string;
      time: number;
      amount: number;
      account: { order_id: string };
    };

    if (!account?.order_id) {
      return paymeError(id, PaymeError.INVALID_PARAMS, 'account.order_id is required');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { idempotency_key: account.order_id },
    });

    if (!payment) {
      return paymeError(id, PaymeError.ORDER_NOT_FOUND, 'Order not found');
    }

    if (BigInt(amount) !== payment.amount_tiyin) {
      return paymeError(id, PaymeError.INVALID_AMOUNT, 'Invalid amount');
    }

    // Если уже есть provider_txn_id — вернуть существующую транзакцию
    if (payment.provider_txn_id) {
      if (payment.provider_txn_id === txnId) {
        // Та же транзакция — идемпотентный ответ
        if (payment.status === PaymentStatus.PAID) {
          return paymeError(id, PaymeError.ORDER_ALREADY_PAID, 'Already paid');
        }
        if (payment.status === PaymentStatus.CANCELLED) {
          return paymeError(id, PaymeError.UNABLE_TO_PERFORM, 'Order cancelled');
        }
        return paymeResult(id, {
          create_time: payment.created_at.getTime(),
          transaction: payment.id,
          state: PaymeState.PENDING,
        });
      }
      // Другая транзакция — ошибка
      return paymeError(id, PaymeError.INVALID_PARAMS, 'Different transaction exists');
    }

    // Проверяем таймаут (Payme time — мс UTC)
    if (Date.now() - time > PAYME_TRANSACTION_TIMEOUT_MS) {
      return paymeError(id, PaymeError.UNABLE_TO_PERFORM, 'Transaction timeout');
    }

    // Сохраняем provider_txn_id
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        provider_txn_id: txnId,
        provider_state: PaymeState.PENDING,
        status: PaymentStatus.AUTHORIZED,
        payload_in: params as object,
      },
    });

    // Логируем webhook
    await this.logWebhook(PaymentProvider.PAYME, txnId, updated.id, params);

    return paymeResult(id, {
      create_time: updated.created_at.getTime(),
      transaction: updated.id,
      state: PaymeState.PENDING,
    });
  }

  // ─── PerformTransaction ──────────────────────────────────────────────────────

  private async performTransaction(
    id: number | string,
    params: Record<string, unknown>,
  ): Promise<PaymeRpcResponse> {
    const { id: txnId } = params as { id: string };

    const payment = await this.prisma.payment.findFirst({
      where: { provider_txn_id: txnId, provider: PaymentProvider.PAYME },
    });

    if (!payment) {
      return paymeError(id, PaymeError.TRANSACTION_NOT_FOUND, 'Transaction not found');
    }

    // Уже оплачен — идемпотентный ответ
    if (payment.status === PaymentStatus.PAID) {
      return paymeResult(id, {
        transaction: payment.id,
        perform_time: payment.paid_at!.getTime(),
        state: PaymeState.COMPLETED,
      });
    }

    if (payment.status === PaymentStatus.CANCELLED) {
      return paymeError(id, PaymeError.UNABLE_TO_PERFORM, 'Transaction cancelled');
    }

    // Проверяем таймаут
    const age = Date.now() - payment.created_at.getTime();
    if (age > PAYME_TRANSACTION_TIMEOUT_MS) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.CANCELLED,
          provider_state: PaymeState.CANCELLED,
          payload_out: { reason: PaymeCancelReason.TRANSACTION_EXPIRED } as object,
        },
      });
      return paymeError(id, PaymeError.UNABLE_TO_PERFORM, 'Transaction expired');
    }

    const paidAt = new Date();

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        provider_state: PaymeState.COMPLETED,
        paid_at: paidAt,
        payload_out: params as object,
      },
    });

    // Активируем запись/пробный + TG-инвайт + Zoom (fire-and-forget)
    void this.payments.handlePaidPayment(payment.id);

    // Фискализация — создаём FiscalReceipt и ставим в очередь BullMQ (fire-and-forget)
    void this.fiscal.scheduleReceipt(payment.id);

    // Уведомление студенту об успешной оплате (fire-and-forget)
    void this.notifications.schedulePaymentConfirmed(
      payment.id,
      payment.user_id,
      payment.amount_tiyin,
    );

    await this.logWebhook(PaymentProvider.PAYME, txnId, payment.id, params);

    return paymeResult(id, {
      transaction: payment.id,
      perform_time: paidAt.getTime(),
      state: PaymeState.COMPLETED,
    });
  }

  // ─── CancelTransaction ───────────────────────────────────────────────────────

  private async cancelTransaction(
    id: number | string,
    params: Record<string, unknown>,
  ): Promise<PaymeRpcResponse> {
    const { id: txnId, reason } = params as { id: string; reason: number };

    const payment = await this.prisma.payment.findFirst({
      where: { provider_txn_id: txnId, provider: PaymentProvider.PAYME },
    });

    if (!payment) {
      return paymeError(id, PaymeError.TRANSACTION_NOT_FOUND, 'Transaction not found');
    }

    // Уже отменён — идемпотентно
    if (payment.status === PaymentStatus.CANCELLED || payment.status === PaymentStatus.REFUNDED) {
      const state =
        payment.provider_state === PaymeState.CANCELLED_AFTER_COMPLETE
          ? PaymeState.CANCELLED_AFTER_COMPLETE
          : PaymeState.CANCELLED;
      return paymeResult(id, {
        transaction: payment.id,
        cancel_time: payment.updated_at.getTime(),
        state,
      });
    }

    // Оплачен — отменяем как refund
    if (payment.status === PaymentStatus.PAID) {
      const cancelTime = new Date();
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          provider_state: PaymeState.CANCELLED_AFTER_COMPLETE,
          refunded_at: cancelTime,
          payload_out: { reason, cancel_time: cancelTime.getTime() } as object,
        },
      });
      await this.logWebhook(PaymentProvider.PAYME, txnId, payment.id, params);

      // Снимаем запись на курс + фискальный чек возврата + уведомление.
      if (payment.class_id) {
        await this.prisma.enrollment.updateMany({
          where: {
            student_id: payment.user_id,
            class_id: payment.class_id,
            status: { in: ['ACTIVE', 'PENDING'] },
          },
          data: { status: 'DROPPED' },
        });
      }
      void this.fiscal.scheduleRefundReceipt(payment.id);
      void this.notifications.schedulePaymentRefunded(
        payment.id,
        payment.user_id,
        payment.amount_tiyin,
      );

      return paymeResult(id, {
        transaction: payment.id,
        cancel_time: cancelTime.getTime(),
        state: PaymeState.CANCELLED_AFTER_COMPLETE,
      });
    }

    // PENDING/AUTHORIZED — просто отменяем
    const cancelTime = new Date();
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.CANCELLED,
        provider_state: PaymeState.CANCELLED,
        payload_out: { reason, cancel_time: cancelTime.getTime() } as object,
      },
    });

    await this.logWebhook(PaymentProvider.PAYME, txnId, payment.id, params);

    return paymeResult(id, {
      transaction: payment.id,
      cancel_time: cancelTime.getTime(),
      state: PaymeState.CANCELLED,
    });
  }

  // ─── CheckTransaction ────────────────────────────────────────────────────────

  private async checkTransaction(
    id: number | string,
    params: Record<string, unknown>,
  ): Promise<PaymeRpcResponse> {
    const { id: txnId } = params as { id: string };

    const payment = await this.prisma.payment.findFirst({
      where: { provider_txn_id: txnId, provider: PaymentProvider.PAYME },
    });

    if (!payment) {
      return paymeError(id, PaymeError.TRANSACTION_NOT_FOUND, 'Transaction not found');
    }

    const state = payment.provider_state ?? PaymeState.PENDING;
    const cancelTime = state < 0 ? payment.updated_at.getTime() : 0;
    const performTime = payment.paid_at ? payment.paid_at.getTime() : 0;

    return paymeResult(id, {
      create_time: payment.created_at.getTime(),
      perform_time: performTime,
      cancel_time: cancelTime,
      transaction: payment.id,
      state,
      reason: null,
    });
  }

  // ─── GetStatement ────────────────────────────────────────────────────────────

  private async getStatement(
    id: number | string,
    params: Record<string, unknown>,
  ): Promise<PaymeRpcResponse> {
    const { from, to } = params as { from: number; to: number };

    const payments = await this.prisma.payment.findMany({
      where: {
        provider: PaymentProvider.PAYME,
        status: PaymentStatus.PAID,
        paid_at: {
          gte: new Date(from),
          lte: new Date(to),
        },
      },
    });

    const transactions = payments.map((p) => ({
      id: p.provider_txn_id,
      time: p.created_at.getTime(),
      amount: Number(p.amount_tiyin),
      account: { order_id: p.idempotency_key },
      create_time: p.created_at.getTime(),
      perform_time: p.paid_at!.getTime(),
      cancel_time: 0,
      transaction: p.id,
      state: PaymeState.COMPLETED,
      reason: null,
    }));

    return paymeResult(id, { transactions });
  }

  // ─── Post-payment trigger ────────────────────────────────────────────────────

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async logWebhook(
    provider: PaymentProvider,
    externalId: string,
    paymentId: string,
    rawBody: Record<string, unknown>,
  ) {
    try {
      await this.prisma.webhookEvent.upsert({
        where: { provider_external_id: { provider, external_id: externalId } },
        create: {
          provider,
          external_id: externalId,
          payment_id: paymentId,
          raw_body: rawBody as object,
          processed: true,
          processed_at: new Date(),
        },
        update: {
          processed: true,
          processed_at: new Date(),
        },
      });
    } catch {
      // Non-critical
    }
  }
}
