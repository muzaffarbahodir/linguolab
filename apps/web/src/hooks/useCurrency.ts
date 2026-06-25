import { useTranslation } from 'react-i18next';
import { useMe } from '../api/users';
import { useExchangeRate } from '../api/config';
import { formatMoney } from '../lib/money';

export function useCurrency() {
  const { i18n } = useTranslation();
  const { data: me } = useMe();
  const { data: rate } = useExchangeRate();

  const currency = me?.preferred_currency ?? 'UZS';
  const uzsPerUsd = rate?.uzs_per_usd ?? 12500;

  function fmt(uzs: number): string {
    return formatMoney(uzs, currency, uzsPerUsd, i18n.language);
  }

  return { fmt, currency, uzsPerUsd };
}
