import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SoliqSendReceiptRequest, SoliqReceiptItem } from './soliq/soliq.types';

/**
 * Структура Payment с необходимыми полями для построения чека.
 * Загружается из БД перед вызовом builder'а.
 */
export interface PaymentForReceipt {
  id: string;
  amount_tiyin: bigint;
  vat_amount_tiyin: bigint;
  vat_rate: number;
  class?: { title: string } | null;
}

/**
 * FiscalReceiptBuilder — формирует тело запроса к Soliq OFD.
 *
 * Особенности:
 *  - Все суммы передаём в тийинах (int, не BigInt — JSON-совместимо).
 *  - VAT уже посчитан в Payment.vat_amount_tiyin.
 *  - IKPU (spic) для образовательных услуг: 10401010001000000 (код «Обучение»).
 *    Получить точный код нужно у Soliq (зависит от ОКВЭД/ИКПУ организации).
 *  - packageCode "1234567" — пакет/единица (штука, часто 1 при услуге).
 *  - units 1221006 — единица измерения «штука» в справочнике Soliq.
 */
@Injectable()
export class FiscalReceiptBuilder {
  /** ИКПУ для образовательных услуг (уточнить у Soliq) */
  private readonly EDUCATION_SPIC = '10401010001000000';
  /** Единица измерения «штука» */
  private readonly UNITS_PIECE = 1221006;
  /** packageCode = 1234567 (стандарт для услуг в UZ) */
  private readonly PACKAGE_CODE = '1234567';

  constructor(private readonly config: ConfigService) {}

  /**
   * Построить запрос на отправку чека продажи (SALE).
   */
  buildSale(payment: PaymentForReceipt): SoliqSendReceiptRequest {
    return this.build(payment, 0 /* receiptType=0 (sale) */);
  }

  /**
   * Построить запрос на отправку чека возврата (REFUND).
   */
  buildRefund(payment: PaymentForReceipt): SoliqSendReceiptRequest {
    return this.build(payment, 1 /* receiptType=1 (refund) */);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private build(payment: PaymentForReceipt, receiptType: 0 | 1): SoliqSendReceiptRequest {
    const terminalId = this.config.get<string>('SOLIQ_TERMINAL_ID') ?? 'TERMINAL';
    const tin = this.config.get<string>('SOLIQ_TIN') ?? '';

    // Конвертируем BigInt → number (safe: тийины помещаются в Number.MAX_SAFE_INTEGER ~9e15)
    const totalAmount = Number(payment.amount_tiyin);
    const totalVat = Number(payment.vat_amount_tiyin);
    const price = totalAmount; // у нас всегда 1 единица услуги
    const vatPercent = payment.vat_rate; // 12
    const name = payment.class?.title
      ? `Обучение: ${payment.class.title}`
      : 'Образовательная услуга (LinguoLab)';

    const items: SoliqReceiptItem[] = [
      {
        name,
        spic: this.EDUCATION_SPIC,
        units: this.UNITS_PIECE,
        packageCode: this.PACKAGE_CODE,
        count: 1,
        price,
        amount: totalAmount,
        vatPercent,
        vat: totalVat,
      },
    ];

    return {
      terminalId,
      tin,
      receiptType,
      time: new Date().toISOString(),
      items,
      receivedCash: 0,
      receivedCard: totalAmount,
      totalAmount,
      totalVat,
      extraData: { paymentId: payment.id },
    };
  }
}
