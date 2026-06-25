/**
 * Утилиты для работы с деньгами в Узбекистане.
 *
 * В Узбекистане:
 *   1 UZS (сум) = 100 тийин
 *
 * Payme и другие платёжные провайдеры работают в тийинах.
 * В нашей БД цены хранятся в сомах (price_uzs: Int).
 * Перед отправкой в провайдер — конвертируем в тийины.
 */

import i18n from './i18n';

/**
 * Конвертировать UZS → USD.
 * @param uzs  сумма в сомах
 * @param uzsPerUsd  курс: сколько сомов за 1 доллар (напр. 12500)
 */
export function uzsToUsd(uzs: number, uzsPerUsd: number): number {
  return uzs / uzsPerUsd;
}

/**
 * Форматировать цену с учётом выбранной пользователем валюты.
 * currency='UZS' → "350 000 UZS"
 * currency='USD' → "28.00 $"
 */
export function formatMoney(
  uzs: number,
  currency: string,
  uzsPerUsd: number,
  locale = i18n.language || 'ru-RU',
): string {
  if (currency === 'USD') {
    const usd = uzsToUsd(uzs, uzsPerUsd);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(usd);
  }
  return formatUzs(uzs, locale);
}

/** Конвертировать сомы → тийины (для платёжных провайдеров) */
export function uzsToTiyin(uzs: number): number {
  return Math.round(uzs * 100);
}

/** Конвертировать тийины → сомы (для отображения) */
export function tiyinToUzs(tiyin: number): number {
  return Math.round(tiyin / 100);
}

/**
 * Форматировать сумму в сомах для отображения пользователю.
 * @example formatUzs(350000) → "350 000 сум"
 */
export function formatUzs(uzs: number, locale = i18n.language || 'ru-RU'): string {
  return (
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(uzs) + ' UZS'
  );
}

/**
 * Форматировать цену класса.
 * @example formatPrice(350000, 'сум') → "350 000 сум/мес"
 */
export function formatPrice(
  uzs: number,
  sumLabel: string,
  locale = i18n.language || 'ru-RU',
): string {
  return (
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
    }).format(uzs) +
    ' ' +
    sumLabel
  );
}
