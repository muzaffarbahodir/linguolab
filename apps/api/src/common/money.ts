/**
 * Утилиты для работы с деньгами (UZS / тийины).
 *
 * В БД цены хранятся в сомах (price_uzs: Int).
 * Payme принимает тийины (1 сум = 100 тийин).
 */

/** Конвертировать сомы → тийины */
export function uzsToTiyin(uzs: number): number {
  return Math.round(uzs * 100);
}

/** Конвертировать тийины → сомы */
export function tiyinToUzs(tiyin: number): number {
  return Math.round(tiyin / 100);
}

/** Рассчитать НДС из суммы в тийинах (включённый НДС, ставка в %) */
export function calcVatTiyin(amountTiyin: number, vatRate = 12): number {
  return Math.round((amountTiyin * vatRate) / (100 + vatRate));
}
