import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { uzsToTiyin, calcVatTiyin } from '../../common/money';
import { FiscalService } from '../fiscal/fiscal.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';

export interface CheckoutDto {
  provider: PaymentProvider;
  class_id: string;
  idempotency_key: string; // UUID v4, генерирует клиент
  /** За кого платим (для родителя — id ребёнка). По умолчанию — сам плательщик. */
  student_id?: string;
  /** ID заявки на очный пробный урок (OFFLINE) — платёж привяжется к ней (legacy). */
  trial_id?: string;
  /** Язык очного пробного — заявка создастся CONFIRMED после оплаты (новый флоу). */
  offline_trial_language_id?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly fiscal: FiscalService,
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * POST /payments/checkout
   * Создаёт Payment-запись, возвращает URL для редиректа в Payme/Click/Uzumbank.
   */
  async checkout(payerId: string, dto: CheckoutDto) {
    // За кого платим: сам плательщик или его ребёнок.
    const studentId = dto.student_id ?? payerId;
    if (studentId !== payerId) {
      // Платить за другого можно только если это привязанный ребёнок.
      const link = await this.prisma.parentChildLink.findUnique({
        where: { parent_id_child_id: { parent_id: payerId, child_id: studentId } },
      });
      if (!link) {
        throw new ForbiddenException('Оплачивать можно только за привязанного ребёнка');
      }
    }

    // Получаем класс заранее — нужен для create-ветки upsert
    const cls = await this.prisma.class.findUnique({
      where: { id: dto.class_id, is_active: true },
      select: { id: true, title: true, price_uzs: true },
    });
    if (!cls) throw new NotFoundException('Class not found or inactive');

    const amountTiyin = BigInt(uzsToTiyin(cls.price_uzs));
    // Ставка НДС из env. 0 = режим без НДС (налог с оборота). По умолчанию 0 —
    // безопаснее, пока режим не подтверждён бухгалтером. См. VAT_RATE в .env.
    const vatRate = Number(this.config.get<string>('VAT_RATE') ?? 0) || 0;
    const vatTiyin = BigInt(calcVatTiyin(Number(amountTiyin), vatRate));

    // Upsert вместо findUnique+create — атомарно, без race condition.
    // user_id = студент-бенефициар (на него запишется курс при PAID),
    // payer_user_id = родитель-плательщик (если платит за ребёнка).
    const payment = await this.prisma.payment.upsert({
      where: { idempotency_key: dto.idempotency_key },
      create: {
        user_id: studentId,
        payer_user_id: studentId === payerId ? null : payerId,
        class_id: dto.class_id,
        amount_tiyin: amountTiyin,
        vat_amount_tiyin: vatTiyin,
        vat_rate: vatRate,
        provider: dto.provider,
        status: PaymentStatus.PENDING,
        idempotency_key: dto.idempotency_key,
        trial_language_id: dto.offline_trial_language_id ?? null,
      },
      update: {}, // уже существует — возвращаем как есть
    });

    // Ключ идемпотентности должен принадлежать этому плательщику.
    const owner = payment.payer_user_id ?? payment.user_id;
    if (owner !== payerId) {
      throw new BadRequestException('Idempotency key belongs to another user');
    }

    // Привязка к очному пробному уроку — после PAID заявка авто-подтвердится.
    // updateMany + payment_id:null = идемпотентно при повторном checkout.
    if (dto.trial_id) {
      await this.prisma.trialLessonRequest.updateMany({
        where: { id: dto.trial_id, student_id: studentId, payment_id: null },
        data: { payment_id: payment.id },
      });
    }

    return this.buildCheckoutResponse(payment);
  }

  /** Строит ответ с redirect URL для провайдера */
  private buildCheckoutResponse(payment: {
    id: string;
    provider: PaymentProvider;
    amount_tiyin: bigint;
    idempotency_key: string;
    status: PaymentStatus;
  }) {
    const redirectUrl = this.buildProviderUrl(
      payment.provider,
      payment.idempotency_key,
      Number(payment.amount_tiyin),
    );

    return {
      payment_id: payment.id,
      status: payment.status,
      provider: payment.provider,
      amount_tiyin: payment.amount_tiyin.toString(),
      redirect_url: redirectUrl,
    };
  }

  /** Формирует URL для редиректа в кассу провайдера */
  private buildProviderUrl(
    provider: PaymentProvider,
    orderId: string,
    amountTiyin: number,
  ): string {
    switch (provider) {
      case PaymentProvider.PAYME: {
        const merchantId = this.config.get<string>('PAYME_MERCHANT_ID') ?? '';
        // Payme URL: https://checkout.paycom.uz/<base64(m=merchantId;ac.order_id=orderId;a=amount)>
        const raw = `m=${merchantId};ac.order_id=${orderId};a=${amountTiyin}`;
        const encoded = Buffer.from(raw).toString('base64');
        const base = this.config.get<string>('PAYME_CHECKOUT_URL') ?? 'https://checkout.paycom.uz';
        return `${base}/${encoded}`;
      }
      case PaymentProvider.CLICK: {
        const serviceId = this.config.get<string>('CLICK_SERVICE_ID') ?? '';
        const merchantId = this.config.get<string>('CLICK_MERCHANT_ID') ?? '';
        return (
          `https://my.click.uz/services/pay?service_id=${serviceId}` +
          `&merchant_id=${merchantId}&amount=${amountTiyin / 100}` +
          `&transaction_param=${orderId}&return_url=${this.config.get('APP_PUBLIC_URL') ?? ''}`
        );
      }
      case PaymentProvider.UZUMBANK: {
        // Uzumbank — placeholder, реальная интеграция в следующей итерации
        return `https://uzumbank.uz/pay?order=${orderId}&amount=${amountTiyin}`;
      }
      case PaymentProvider.CASH: {
        // Наличные — нет онлайн-кассы. Платёж PENDING, менеджер подтверждает вручную.
        return '';
      }
    }
  }

  /**
   * Единая обработка успешной оплаты — Payme и Click вызывают это после PAID.
   *  - Очный пробный (OFFLINE trial): платёж привязан к trial → trial CONFIRMED,
   *    запись в класс НЕ создаём (урок очный).
   *  - Оплата курса: enrollment → ACTIVE, авто-открытие группы (первый оплативший),
   *    инвайт в TG-группу + Zoom-ссылка, уведомление.
   * Идемпотентно (upsert + проверки статусов). fire-and-forget из вебхуков.
   */
  async handlePaidPayment(paymentId: string): Promise<void> {
    try {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          user: { select: { id: true, telegram_user_id: true } },
          class: {
            select: {
              id: true,
              title: true,
              telegram_chat_id: true,
              meeting_url: true,
              status: true,
            },
          },
          trial: { select: { id: true, language: { select: { name_ru: true } } } },
        },
      });
      if (!payment) return;

      // ── Очный пробный урок (legacy: заявка уже была привязана) ──
      if (payment.trial) {
        await this.prisma.trialLessonRequest.update({
          where: { id: payment.trial.id },
          data: { status: 'CONFIRMED' },
        });
        void this.notifications.scheduleTrialConfirmed(
          payment.user_id,
          payment.trial.language.name_ru,
          payment.trial.id,
        );
        return;
      }

      // ── Очный пробный урок (новый флоу): заявка создаётся CONFIRMED после оплаты ──
      if (payment.trial_language_id) {
        const existing = await this.prisma.trialLessonRequest.findFirst({
          where: {
            student_id: payment.user_id,
            language_id: payment.trial_language_id,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          select: { id: true },
        });
        if (!existing) {
          const tr = await this.prisma.trialLessonRequest.create({
            data: {
              student_id: payment.user_id,
              language_id: payment.trial_language_id,
              type: 'OFFLINE',
              class_id: payment.class_id,
              payment_id: payment.id,
              status: 'CONFIRMED',
            },
            select: { id: true, language: { select: { name_ru: true } } },
          });
          void this.notifications.scheduleTrialConfirmed(
            payment.user_id,
            tr.language.name_ru,
            tr.id,
          );
        }
        return;
      }

      // ── Оплата курса ──
      if (!payment.class || !payment.user) return;

      await this.prisma.enrollment.upsert({
        where: {
          student_id_class_id: { student_id: payment.user_id, class_id: payment.class.id },
        },
        update: { status: 'ACTIVE' },
        create: { student_id: payment.user_id, class_id: payment.class.id, status: 'ACTIVE' },
      });

      // Авто-открытие группы: первый оплативший студент → класс ACTIVE и виден.
      if (payment.class.status === 'DRAFT' || payment.class.status === 'ENROLLMENT_OPEN') {
        await this.prisma.class.update({
          where: { id: payment.class.id },
          data: { status: 'ACTIVE', is_active: true },
        });
      }

      // Инвайт в TG-группу класса
      if (payment.class.telegram_chat_id) {
        await this.telegram.sendGroupInvite(
          payment.user.telegram_user_id,
          payment.class.telegram_chat_id,
          payment.class.title,
        );
      }

      // Ссылка на онлайн-урок (Zoom/Meet)
      if (payment.class.meeting_url) {
        await this.telegram.sendMessageStr(
          payment.user.telegram_user_id.toString(),
          `🎥 <b>${payment.class.title}</b>\n\nСсылка на онлайн-урок:\n${payment.class.meeting_url}`,
        );
      }

      void this.notifications.scheduleEnrollmentConfirmed(
        payment.user_id,
        payment.class.title,
        payment.class.id,
      );
    } catch (err) {
      this.logger.error(`handlePaidPayment(${paymentId}): ${String(err)}`);
    }
  }

  // ─── History ─────────────────────────────────────────────────────────────────

  async myPayments(userId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { user_id: userId },
      select: {
        id: true,
        amount_tiyin: true,
        provider: true,
        status: true,
        class: { select: { title: true, level: true } },
        paid_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return payments.map((p) => ({ ...p, amount_tiyin: p.amount_tiyin.toString() }));
  }

  async getPayment(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, user_id: userId },
      include: {
        class: { select: { title: true, level: true, language: { select: { flag_emoji: true } } } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    return {
      ...payment,
      amount_tiyin: payment.amount_tiyin.toString(),
      vat_amount_tiyin: payment.vat_amount_tiyin.toString(),
    };
  }

  /**
   * GET /payments/:id/receipt — фискальный чек студента (по кнопке).
   * Проверяем владельца (студент или родитель-плательщик). Если чек ещё не
   * сформирован — возвращаем status:'NONE' (фронт покажет «формируется»).
   */
  async getMyReceipt(paymentId: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, OR: [{ user_id: userId }, { payer_user_id: userId }] },
      select: { id: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const receipt = await this.prisma.fiscalReceipt.findUnique({
      where: { payment_id: paymentId },
      select: {
        status: true,
        receipt_type: true,
        receipt_url: true,
        fiscal_sign: true,
        fiscal_number: true,
      },
    });
    if (!receipt) {
      return {
        status: 'NONE' as const,
        receipt_url: null,
        fiscal_sign: null,
        fiscal_number: null,
      };
    }
    return receipt;
  }

  async getLastPending(userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { user_id: userId, status: PaymentStatus.PENDING },
      orderBy: { created_at: 'desc' },
      include: { class: { select: { title: true } } },
    });

    if (!payment) return null;

    return {
      ...payment,
      amount_tiyin: payment.amount_tiyin.toString(),
      vat_amount_tiyin: payment.vat_amount_tiyin.toString(),
      redirect_url: this.buildProviderUrl(
        payment.provider,
        payment.idempotency_key,
        Number(payment.amount_tiyin),
      ),
    };
  }

  // ─── Admin ───────────────────────────────────────────────────────────────────

  async adminListPayments(page = 1, limit = 20, status?: PaymentStatus) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: {
          user: { select: { first_name: true, last_name: true, telegram_username: true } },
          class: { select: { title: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        ...p,
        amount_tiyin: p.amount_tiyin.toString(),
        vat_amount_tiyin: p.vat_amount_tiyin.toString(),
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Номер заказа (как номер чека) из id — детерминированный хэш.
   * ВАЖНО: должен совпадать с фронтовым orderNo() (apps/web/src/lib/orderNumber.ts).
   */
  private orderNo(prefix: string, id: string): string {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return `${prefix}-${String(h % 1_000_000).padStart(6, '0')}`;
  }

  /**
   * GET /payments/admin/resolve/:number — ручной ввод номера заказа (если камера
   * не сработала). Номер необратим, поэтому пересчитываем хэш по наличным платежам.
   */
  async adminResolveOrder(number: string) {
    const digits = number.replace(/\D/g, '').padStart(6, '0');
    if (digits.length !== 6) throw new BadRequestException('Invalid order number');

    const candidates = await this.prisma.payment.findMany({
      where: { provider: PaymentProvider.CASH },
      select: { id: true },
      orderBy: { created_at: 'desc' },
      take: 1000,
    });
    const match = candidates.find((c) => this.orderNo('P', c.id) === `P-${digits}`);
    if (!match) throw new NotFoundException('Order not found');
    return { id: match.id };
  }

  /** GET /payments/admin/:id — карточка платежа для менеджера (скан QR наличного чека). */
  async adminGetPayment(paymentId: string) {
    const p = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        user: { select: { first_name: true, last_name: true, telegram_username: true } },
        class: { select: { title: true, level: true } },
      },
    });
    if (!p) throw new NotFoundException('Payment not found');
    return {
      id: p.id,
      amount_tiyin: p.amount_tiyin.toString(),
      provider: p.provider,
      status: p.status,
      created_at: p.created_at,
      user: p.user,
      class: p.class,
    };
  }

  /**
   * Подтверждение наличной оплаты (MANAGER+). Идемпотентно.
   * Студент выбрал «Наличные» → создан PENDING-платёж с provider=CASH.
   * Менеджер принял деньги → переводим в PAID и запускаем ту же доменную
   * обработку, что Payme/Click после оплаты: enrollment ACTIVE + фискальный чек.
   */
  async adminConfirmCash(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.provider !== PaymentProvider.CASH) {
      throw new BadRequestException('Only CASH payments can be confirmed manually');
    }
    // Идемпотентность: уже оплачен — повторно не делаем.
    if (payment.status === PaymentStatus.PAID) {
      return { ok: true, payment_id: payment.id, status: payment.status, already: true };
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot confirm payment in status ${payment.status}`);
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, paid_at: new Date() },
    });

    // Та же доменная обработка, что у онлайн-провайдеров после PAID.
    await this.handlePaidPayment(updated.id);
    void this.fiscal.scheduleReceipt(updated.id);

    this.logger.log(`Cash payment ${updated.id} confirmed manually`);

    return { ok: true, payment_id: updated.id, status: updated.status, already: false };
  }

  /**
   * Возврат платежа (ADMIN+). Идемпотентно.
   * Делает доменную часть, которую мы контролируем:
   *  - статус REFUNDED + дата + причина
   *  - СНЯТИЕ записи на курс (enrollment → DROPPED)
   *  - фискальный чек возврата + уведомление студенту
   *
   * ВАЖНО: фактический возврат денег провайдеру делается в кабинете Payme/Click
   * (merchant-initiated refund API у них через кабинет). Для Payme отмена в
   * кабинете дополнительно прилетит как CancelTransaction — обработается идемпотентно.
   * `provider_action_required: true` в ответе — сигнал админу довершить в кассе.
   */
  async adminRefund(paymentId: string, reason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');

    // Идемпотентность: уже возвращён — повторно не делаем.
    if (payment.status === PaymentStatus.REFUNDED) {
      return {
        ok: true,
        payment_id: payment.id,
        status: payment.status,
        already: true,
        provider_action_required: false,
      };
    }
    if (payment.status !== PaymentStatus.PAID) {
      throw new BadRequestException('Only PAID payments can be refunded');
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        refunded_at: new Date(),
        refund_reason: reason?.trim() || null,
      },
    });

    // Снимаем запись на курс (бенефициар = user_id).
    await this.revokeEnrollment(updated.user_id, updated.class_id);

    // Фискализация возврата + уведомление (fire-and-forget).
    void this.fiscal.scheduleRefundReceipt(updated.id);
    void this.notifications.schedulePaymentRefunded(
      updated.id,
      updated.user_id,
      updated.amount_tiyin,
    );

    this.logger.log(`Refund: payment ${updated.id} (${updated.provider}) reason="${reason ?? ''}"`);

    return {
      ok: true,
      payment_id: updated.id,
      status: updated.status,
      already: false,
      // Деньги вернуть в кабинете провайдера (API merchant-refund — через кабинет).
      provider_action_required: true,
    };
  }

  /** Снимает запись студента на курс при возврате (ACTIVE/PENDING → DROPPED). */
  private async revokeEnrollment(studentId: string, classId: string | null) {
    if (!classId) return;
    await this.prisma.enrollment.updateMany({
      where: { student_id: studentId, class_id: classId, status: { in: ['ACTIVE', 'PENDING'] } },
      data: { status: 'DROPPED' },
    });
  }
}
