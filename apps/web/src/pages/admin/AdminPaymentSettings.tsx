/**
 * AdminPaymentSettings — настройка платёжных провайдеров.
 * ADMIN+ only. Route: /admin/payment-settings
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import { usePaymentProviders, useUpdatePaymentProvider } from '../../api/admin';

const PROVIDER_INFO: Record<string, { label: string; logo: string; color: string }> = {
  PAYME: { label: 'Payme', logo: '💳', color: '#00AACC' },
  CLICK: { label: 'Click', logo: '🔵', color: '#0078D4' },
  UZUMBANK: { label: 'Uzum Bank', logo: '🟠', color: '#FF6B00' },
};

export function AdminPaymentSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = usePaymentProviders();
  const update = useUpdatePaymentProvider();

  useBackButton(() => navigate('/admin'));

  function toggle(provider: string, current: boolean) {
    update.mutate(
      { provider, is_enabled: !current },
      {
        onSuccess: () => WebApp.HapticFeedback.selectionChanged(),
        onError: () => WebApp.showAlert(t('admin.payment_settings.update_error')),
      },
    );
  }

  const sorted = [...(data ?? [])].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass border-surface-2 border-b px-4 pb-4 pt-6">
        <h1 className="text-lg font-bold">{t('admin.payment_settings.title')}</h1>
        <p className="text-muted text-xs">{t('admin.payment_settings.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {sorted.map((p) => {
          const info = PROVIDER_INFO[p.provider] ?? {
            label: p.provider,
            logo: '💰',
            color: '#C8623F',
          };
          return (
            <div
              key={p.provider}
              className="flex items-center gap-4 rounded-2xl p-4"
              style={{
                background: p.is_enabled ? `${info.color}12` : 'var(--surface-2)',
                border: `1px solid ${p.is_enabled ? info.color + '33' : 'var(--surface-2)'}`,
                opacity: p.is_enabled ? 1 : 0.6,
              }}
            >
              <span className="text-3xl">{info.logo}</span>
              <div className="flex-1">
                <p className="font-semibold">{info.label}</p>
                <p className="text-muted text-xs">
                  {t('admin.payment_settings.order', { n: p.display_order })}
                </p>
              </div>

              {/* Toggle */}
              <button
                onClick={() => toggle(p.provider, p.is_enabled)}
                disabled={update.isPending}
                className="relative h-7 w-12 rounded-full transition-all disabled:opacity-40"
                style={{
                  background: p.is_enabled ? info.color : 'var(--surface-2)',
                }}
              >
                <span
                  className="absolute top-1 h-5 w-5 rounded-full bg-white transition-all"
                  style={{ left: p.is_enabled ? '26px' : '4px' }}
                />
              </button>
            </div>
          );
        })}

        {!isLoading && !data?.length && (
          <p className="text-muted py-10 text-center text-sm">
            {t('admin.payment_settings.no_data')}
          </p>
        )}

        <div className="bg-warn/10 border-warn/20 mt-2 rounded-2xl border px-4 py-3">
          <p className="text-warn text-xs">{t('admin.payment_settings.warning')}</p>
        </div>
      </div>
    </div>
  );
}
