/**
 * Типы для Soliq OFD API (Узбекистан).
 *
 * Документация: https://ofd.soliq.uz (требует регистрации).
 * Sandbox: https://ofd-test.soliq.uz
 *
 * Протокол: REST/JSON, Bearer-аутентификация.
 * Все суммы передаются в тийинах (1 UZS = 100 tiyin).
 */

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface SoliqAuthRequest {
  clientId: string; // SOLIQ_CLIENT_ID (обычно = ИНН)
  clientSecret: string; // SOLIQ_CLIENT_SECRET
}

export interface SoliqAuthResponse {
  accessToken: string;
  expiresAt: string; // ISO 8601
}

// ─── Receipt items ────────────────────────────────────────────────────────────

export interface SoliqReceiptItem {
  /** Наименование товара/услуги */
  name: string;
  /** ИКПУ (код товара/услуги) — справочник Soliq */
  spic: string;
  /** Единица измерения (1221006 = штука) */
  units: number;
  /** Количество (в сотых долях единицы: 100 = 1 штука) */
  packageCode: string;
  /** Количество штук */
  count: number;
  /** Цена за единицу в тийинах */
  price: number;
  /** Сумма строки = count * price */
  amount: number;
  /** Ставка НДС % (12) */
  vatPercent: number;
  /** Сумма НДС по строке в тийинах */
  vat: number;
}

// ─── Send receipt ─────────────────────────────────────────────────────────────

export interface SoliqSendReceiptRequest {
  /** ID терминала (SOLIQ_TERMINAL_ID) */
  terminalId: string;
  /** ИНН организации */
  tin: string;
  /** Тип операции: 0 = продажа, 1 = возврат */
  receiptType: 0 | 1;
  /** ISO 8601 дата/время операции */
  time: string;
  /** Строки чека */
  items: SoliqReceiptItem[];
  /** Сумма наличными в тийинах (0 при оплате картой) */
  receivedCash: number;
  /** Сумма безналом в тийинах */
  receivedCard: number;
  /** Общая сумма чека в тийинах */
  totalAmount: number;
  /** Общий НДС в тийинах */
  totalVat: number;
  /** Идентификатор платежа на нашей стороне (для идемпотентности) */
  extraData?: Record<string, string>;
}

export interface SoliqSendReceiptResponse {
  success: boolean;
  receiptId?: string;
  fiscalSign?: string; // QR-строка
  fiscalNumber?: string; // номер чека в ОФД
  receiptUrl?: string; // ссылка на PDF-чек
  errorCode?: string;
  errorMessage?: string;
}
