import { useTranslation } from 'react-i18next';

import { formatUzs } from '../lib/money';

/**
 * Форматирование цен. Валюта одна — сум.
 *
 * Переключатель UZS/USD убран: центр в Узбекистане, цены назначены в сумах,
 * а долларовая витрина считалась по плавающему курсу. Получалась вторая
 * цена, на которую нельзя сослаться и которой нельзя заплатить — Click,
 * Payme и Uzumbank принимают только сумы.
 *
 * Хук оставлен на месте: цены форматируются через него по всему приложению,
 * и если валют когда-нибудь станет две, менять придётся только здесь.
 */
export function useCurrency() {
  const { i18n } = useTranslation();

  function fmt(uzs: number): string {
    return formatUzs(uzs, i18n.language);
  }

  return { fmt, currency: 'UZS' as const };
}
