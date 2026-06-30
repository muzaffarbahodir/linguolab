/**
 * PointsPage — лояльные баллы (кэшбэк): баланс, уровень, история начислений.
 * Route: /points
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Coins, Gift, TrendingUp } from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { usePoints, type PointsLevel } from '../api/points';
import { formatUzs } from '../lib/money';
import { EmptyState } from '../components/EmptyState';

const LEVEL: Record<PointsLevel, { emoji: string; color: string }> = {
  bronze: { emoji: '🥉', color: '#CD7F32' },
  silver: { emoji: '🥈', color: '#9CA3AF' },
  gold: { emoji: '🥇', color: '#F5B445' },
  platinum: { emoji: '💎', color: '#5B9DFF' },
};

function txColor(amount: number): string {
  return amount >= 0 ? 'var(--ok, #10B981)' : '#EF4444';
}

export function PointsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = usePoints();

  useBackButton(() => navigate('/profile'));

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  const lvl = LEVEL[data.level];
  const worth = data.points * data.point_value_uzs;
  const nextAt = data.next_level_points;
  const progress = nextAt
    ? Math.min(100, Math.round((data.total_earned_points / nextAt) * 100))
    : 100;

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-12 pt-6">
      <div className="mb-1 flex items-center gap-2">
        <Coins size={22} className="text-warn" />
        <h1 className="text-xl font-bold">{t('points.title')}</h1>
      </div>
      <p className="text-muted mb-4 text-sm">{t('points.subtitle')}</p>

      {/* Баланс + уровень */}
      <div className="glass-card mb-4 rounded-2xl p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-muted text-[11px] font-semibold uppercase tracking-wide">
              {t('points.balance')}
            </div>
            <div className="text-warn text-3xl font-bold tabular-nums">{data.points}</div>
            <div className="text-faint text-xs">≈ {formatUzs(worth)}</div>
          </div>
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold"
            style={{ background: `${lvl.color}1f`, color: lvl.color }}
          >
            <span>{lvl.emoji}</span>
            {t(`points.level_${data.level}`)}
          </div>
        </div>

        <div className="bg-surface-2 mt-3 h-2 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, background: lvl.color }}
          />
        </div>
        <p className="text-faint mt-1.5 text-[11px]">
          {nextAt
            ? t('points.to_next', { n: Math.max(0, nextAt - data.total_earned_points) })
            : t('points.max_level')}
        </p>
      </div>

      {/* Как заработать */}
      <div className="glass-card mb-4 flex flex-col gap-2 rounded-2xl p-4">
        <div className="flex items-start gap-2.5">
          <TrendingUp size={18} className="text-ok mt-0.5 shrink-0" />
          <p className="text-sm">{t('points.how_cashback')}</p>
        </div>
        <div className="flex items-start gap-2.5">
          <Gift size={18} className="text-brand mt-0.5 shrink-0" />
          <p className="text-sm">{t('points.how_referral')}</p>
        </div>
      </div>

      {/* История */}
      <h2 className="text-muted mb-2 px-1 text-xs font-semibold uppercase tracking-wide">
        {t('points.history')}
      </h2>
      {data.transactions.length === 0 ? (
        <EmptyState emoji="🪙" title={t('points.empty')} />
      ) : (
        <div className="glass-section overflow-hidden rounded-2xl">
          {data.transactions.map((tx, i) => (
            <div
              key={tx.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${
                i < data.transactions.length - 1 ? 'border-hairline border-b' : ''
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.description ?? tx.type}</p>
                <p className="text-faint text-xs">
                  {new Date(tx.created_at).toLocaleDateString(i18n.language)}
                </p>
              </div>
              <span
                className="shrink-0 text-sm font-bold tabular-nums"
                style={{ color: txColor(tx.amount) }}
              >
                {tx.amount >= 0 ? '+' : ''}
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
