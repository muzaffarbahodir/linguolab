/**
 * AdminTrials — менеджер рассматривает заявки на пробные уроки.
 * Route: /admin/trials
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useAllTrials,
  useUpdateTrialStatus,
  type TrialRequestManager,
} from '../../api/trial-lessons';

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_TABS: { key: string | undefined; tKey: string }[] = [
  { key: 'PENDING', tKey: 'admin.trials.pending' },
  { key: undefined, tKey: 'admin.trials.filter_all' },
  { key: 'CONFIRMED', tKey: 'admin.trials.confirmed' },
  { key: 'CANCELLED', tKey: 'admin.trials.cancelled' },
];

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  CONFIRMED: '#10B981',
  CANCELLED: '#EF4444',
};
const STATUS_TKEY: Record<string, string> = {
  PENDING: 'admin.trials.pending',
  CONFIRMED: 'admin.trials.confirmed',
  CANCELLED: 'admin.trials.cancelled',
};

// ── TrialCard ─────────────────────────────────────────────────────────────────

function TrialCard({ trial, onAction }: { trial: TrialRequestManager; onAction: () => void }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateTrialStatus();
  const [busy, setBusy] = useState(false);

  const date = new Date(trial.created_at).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  function act(status: 'CONFIRMED' | 'CANCELLED') {
    if (busy) return;
    WebApp.HapticFeedback.impactOccurred('medium');
    setBusy(true);
    update.mutate(
      { id: trial.id, status },
      {
        onSuccess: () => {
          setBusy(false);
          onAction();
        },
        onError: () => setBusy(false),
      },
    );
  }

  const isPending = trial.status === 'PENDING';

  return (
    <div className="bg-surface border-hairline rounded-2xl border p-4">
      {/* Language + status row */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{trial.language.flag_emoji}</span>
          <span className="font-semibold">{trial.language.name_ru}</span>
        </div>
        <span
          className="rounded-lg px-2 py-0.5 text-xs font-bold"
          style={{
            background: `${STATUS_COLOR[trial.status]}22`,
            color: STATUS_COLOR[trial.status],
          }}
        >
          {t(STATUS_TKEY[trial.status] ?? 'admin.trials.pending')}
        </span>
      </div>

      {/* Student */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm">👤</span>
        <div>
          <p className="text-sm font-medium">
            {trial.student.first_name} {trial.student.last_name}
          </p>
          {trial.student.telegram_username && (
            <p className="text-muted text-xs">@{trial.student.telegram_username}</p>
          )}
        </div>
      </div>

      {/* Note */}
      {trial.note && (
        <p className="bg-surface mb-2 rounded-xl px-3 py-2 text-xs text-white/60">
          💬 {trial.note}
        </p>
      )}

      {/* Date */}
      <p className="text-faint mb-3 text-xs">📅 {date}</p>

      {/* Actions — only for PENDING */}
      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={() => act('CONFIRMED')}
            disabled={busy}
            className="bg-ok/15 text-ok press flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold disabled:opacity-40"
          >
            {t('admin.trials.confirm_btn')}
          </button>
          <button
            onClick={() => act('CANCELLED')}
            disabled={busy}
            className="bg-danger/10 text-danger press flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold disabled:opacity-40"
          >
            {t('admin.trials.cancel_btn')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminTrialsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | undefined>('PENDING');

  const { data, isLoading, isError, refetch } = useAllTrials(activeTab);

  useBackButton(() => navigate('/admin'));

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      {/* Header */}
      <div className="glass px-4 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <div>
            <h1 className="text-lg font-bold">{t('admin.trials.title')}</h1>
            {data && data.length > 0 && (
              <p className="text-muted text-xs">
                {data.length}{' '}
                {data.length === 1
                  ? t('admin.trials.count_1')
                  : data.length < 5
                    ? t('admin.trials.count_few')
                    : t('admin.trials.count_many')}
              </p>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {STATUS_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={String(tab.key)}
                onClick={() => {
                  WebApp.HapticFeedback.selectionChanged();
                  setActiveTab(tab.key);
                }}
                className={`press shrink-0 rounded-xl px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active ? 'bg-brand text-white' : 'bg-brand/10 text-muted'
                }`}
              >
                {t(tab.tKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {isError && (
          <p className="text-muted py-10 text-center text-sm">{t('admin.trials.load_error')}</p>
        )}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="bg-brand/10 flex h-20 w-20 items-center justify-center rounded-full text-4xl">
              🎯
            </div>
            <div>
              <p className="font-bold">{t('admin.trials.no_trials')}</p>
              <p className="text-muted mt-1 text-sm">
                {activeTab === 'PENDING'
                  ? t('admin.trials.empty_pending')
                  : t('admin.trials.empty_filter')}
              </p>
            </div>
          </div>
        )}

        <div className="stagger flex flex-col gap-3">
          {data?.map((trial) => (
            <TrialCard key={trial.id} trial={trial} onAction={() => void refetch()} />
          ))}
        </div>
      </div>
    </div>
  );
}
