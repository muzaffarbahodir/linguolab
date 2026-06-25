/**
 * NotInTelegramPage — fallback экран для запуска вне Telegram.
 *
 * Показывается когда:
 * - WebApp.initData пустой (браузер, не Telegram WebView)
 * - Auth init вернул ошибку и нет initData
 *
 * Инструкция: открой через бота @linguolab_bot → /app
 */
import { useTranslation } from 'react-i18next';

export function NotInTelegramPage() {
  const { t } = useTranslation();

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: '#16202e' }}
    >
      <div className="floral-float mb-6 text-6xl">✈️</div>
      <h1 className="shimmer-brand-text mb-2 text-2xl font-bold">{t('not_in_telegram.title')}</h1>
      <p className="text-tg-hint mb-6">{t('not_in_telegram.subtitle')}</p>
      <a
        href="https://t.me/linguolab_bot/app"
        className="glass-btn inline-block rounded-xl px-6 py-3 text-sm font-semibold"
      >
        {t('not_in_telegram.open')}
      </a>
    </div>
  );
}
