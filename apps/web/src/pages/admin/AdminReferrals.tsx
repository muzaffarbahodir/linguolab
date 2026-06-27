/**
 * AdminReferrals — аналитика реферальной программы.
 * Route: /admin/referrals  (MANAGER+)
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '../../hooks/useBackButton';

import { useReferralStats } from '../../api/admin';

export function AdminReferralsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useReferralStats();

  useBackButton(() => navigate('/admin'));

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass border-surface-2 border-b px-4 pb-4 pt-6">
        <h1 className="text-lg font-bold">{t('admin.referrals.title')}</h1>
        <p className="text-muted text-xs">{t('admin.referrals.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="stagger grid grid-cols-3 gap-3">
              {[
                {
                  label: t('admin.referrals.codes_created'),
                  value: data.total,
                  color: '#6366f1',
                  emoji: '🔗',
                },
                {
                  label: t('admin.referrals.redeemed'),
                  value: data.redeemed,
                  color: '#10B981',
                  emoji: '✅',
                },
                {
                  label: t('admin.referrals.conversion'),
                  value: `${data.conversion_pct}%`,
                  color: '#F59E0B',
                  emoji: '📊',
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="flex flex-col items-center gap-1 rounded-2xl py-4"
                  style={{ background: `${s.color}12`, border: `1px solid ${s.color}25` }}
                >
                  <span className="text-xl">{s.emoji}</span>
                  <p className="text-xl font-bold" style={{ color: s.color }}>
                    {s.value}
                  </p>
                  <p className="text-muted text-center text-[10px] font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Top referrers */}
            {data.top_referrers.length > 0 && (
              <div className="bg-surface border-hairline rounded-2xl border p-4">
                <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wide">
                  {t('admin.referrals.top_title')}
                </p>
                <div className="stagger flex flex-col gap-3">
                  {data.top_referrers.map((r, i) => {
                    const name = `${r.referrer.first_name} ${r.referrer.last_name ?? ''}`.trim();
                    return (
                      <div key={r.code} className="flex items-center gap-3">
                        <span
                          className="w-6 text-center text-lg font-bold"
                          style={{ color: i < 3 ? '#F59E0B' : 'var(--surface-2)' }}
                        >
                          {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{name}</p>
                          {r.referrer.telegram_username && (
                            <p className="text-muted text-xs">@{r.referrer.telegram_username}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-ok text-sm font-bold">
                            {r.used_count} {t('admin.referrals.invitations')}
                          </p>
                          {r.bonus_days_granted > 0 && (
                            <p className="text-brand-400 text-xs">
                              {t('admin.referrals.bonus_days', { n: r.bonus_days_granted })}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {data.top_referrers.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="text-5xl">🔗</span>
                <p className="font-bold">{t('admin.referrals.no_data')}</p>
                <p className="text-muted text-sm">{t('admin.referrals.no_data_sub')}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
