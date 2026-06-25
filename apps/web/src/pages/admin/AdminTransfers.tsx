import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import i18n from '../../lib/i18n';
import {
  useAllTransfers,
  useApproveTransfer,
  useRejectTransfer,
  type ManagerTransfer,
} from '../../api/enrollments';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_TKEY: Record<string, string> = {
  PENDING: 'admin.transfers.status_PENDING',
  APPROVED: 'admin.transfers.status_APPROVED',
  REJECTED: 'admin.transfers.status_REJECTED',
  CANCELLED: 'admin.transfers.status_CANCELLED',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  APPROVED: '#10B981',
  REJECTED: '#EF4444',
  CANCELLED: '#6B7280',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return i18n.t('notifications.min_ago', { n: Math.floor(diff / 60_000) });
  if (h < 24) return i18n.t('notifications.hour_ago', { n: h });
  return i18n.t('notifications.day_ago', { n: Math.floor(h / 24) });
}

// ─── Transfer Card ────────────────────────────────────────────────────────────

function TransferCard({ tr, onAction }: { tr: ManagerTransfer; onAction: () => void }) {
  const { t } = useTranslation();
  const approve = useApproveTransfer();
  const reject = useRejectTransfer();
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);

  const isPending = tr.status === 'PENDING';
  const spotsLeft = tr.to_class.max_students - tr.to_class._count.enrollments;

  function handleApprove() {
    approve.mutate(
      { id: tr.id, admin_note: note.trim() || undefined },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          onAction();
        },
        onError: (e: unknown) => {
          const msg = e instanceof Error ? e.message : t('admin.transfers.error');
          WebApp.showAlert(msg);
        },
      },
    );
  }

  function handleReject() {
    reject.mutate(
      { id: tr.id, admin_note: note.trim() || undefined },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('warning');
          onAction();
        },
        onError: (e: unknown) => {
          const msg = e instanceof Error ? e.message : t('admin.transfers.error');
          WebApp.showAlert(msg);
        },
      },
    );
  }

  const color = STATUS_COLOR[tr.status] ?? '#6B7280';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        tr.status === 'PENDING' ? 'bg-warn/5 border-warn/20' : 'border-surface-2 bg-white/[0.03]'
      }`}
    >
      {/* Status badge + time */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className="rounded-lg px-2 py-0.5 text-xs font-bold"
          style={{ background: `${color}20`, color }}
        >
          {t(STATUS_TKEY[tr.status] ?? 'admin.transfers.status_PENDING')}
        </span>
        <span className="text-faint text-[10px]">{timeAgo(tr.created_at)}</span>
      </div>

      {/* Student */}
      <div className="mb-2 flex items-center gap-2">
        <div className="bg-brand/20 text-brand-400 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold">
          {tr.student.first_name[0]}
        </div>
        <div>
          <p className="text-sm font-semibold">
            {tr.student.first_name} {tr.student.last_name ?? ''}
          </p>
          {tr.student.telegram_username && (
            <p className="text-faint text-[10px]">@{tr.student.telegram_username}</p>
          )}
        </div>
      </div>

      {/* Classes */}
      <div className="bg-surface mb-2 flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
        <span className="font-medium text-white/60">{tr.from_class.title}</span>
        <span className="text-faint">→</span>
        <span className="font-semibold text-white">{tr.to_class.title}</span>
        <span
          className="ml-auto"
          style={{ color: spotsLeft > 0 ? '#10B981' : '#EF4444', fontSize: 10 }}
        >
          {spotsLeft > 0
            ? t('admin.transfers.spots', { n: spotsLeft })
            : t('admin.transfers.no_spots_lbl')}
        </span>
      </div>

      {/* Fee */}
      {tr.fee_uzs > 0 && <p className="text-warn mb-2 text-xs">💳 {tr.fee_uzs.toLocaleString()}</p>}

      {/* Reason */}
      {tr.reason && <p className="text-muted mb-2 text-xs leading-relaxed">💬 {tr.reason}</p>}

      {/* Admin note on resolved */}
      {tr.admin_note && !isPending && (
        <p className="text-muted mb-2 text-xs leading-relaxed">📝 {tr.admin_note}</p>
      )}

      {/* Actions (only PENDING) */}
      {isPending && (
        <>
          {showNote && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('admin.transfers.note_ph')}
              rows={2}
              className="bg-surface-2 border-hairline mb-2 w-full resize-none rounded-xl border px-3 py-2 text-xs text-white outline-none"
            />
          )}
          <div className="flex gap-2">
            {rejectMode ? (
              <>
                <button
                  onClick={() => {
                    setRejectMode(false);
                    setShowNote(false);
                  }}
                  className="bg-surface-2 text-muted press flex-1 rounded-xl py-2 text-xs font-semibold"
                >
                  {t('homework.cancel')}
                </button>
                <button
                  onClick={handleReject}
                  disabled={reject.isPending}
                  className="bg-danger/20 text-danger press flex-1 rounded-xl py-2 text-xs font-bold disabled:opacity-40"
                >
                  {reject.isPending ? '...' : t('admin.transfers.reject')}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setRejectMode(true);
                    setShowNote(true);
                  }}
                  className="bg-danger/10 text-danger press flex-1 rounded-xl py-2 text-xs font-semibold"
                >
                  {t('admin.transfers.reject')}
                </button>
                <button
                  onClick={() => {
                    if (!showNote) {
                      setShowNote(true);
                      return;
                    }
                    handleApprove();
                  }}
                  disabled={approve.isPending}
                  className="bg-ok/20 text-ok press flex-1 rounded-xl py-2 text-xs font-bold disabled:opacity-40"
                >
                  {approve.isPending ? '...' : t('admin.transfers.approve')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const FILTERS = [
  { tKey: 'admin.transfers.filter_pending', value: 'PENDING', color: '#F59E0B' },
  { tKey: 'admin.transfers.filter_all', value: '', color: '#6B7280' },
  { tKey: 'admin.transfers.filter_approved', value: 'APPROVED', color: '#10B981' },
  { tKey: 'admin.transfers.filter_rejected', value: 'REJECTED', color: '#EF4444' },
];

export function AdminTransfersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('PENDING');
  const { data, isLoading, refetch } = useAllTransfers(filter || undefined);

  useBackButton(() => navigate('/admin'));

  const pending = data?.filter((x) => x.status === 'PENDING').length ?? 0;

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      {/* Header */}
      <div className="glass px-4 pb-3 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔄</span>
          <h1 className="text-lg font-bold">{t('admin.transfers.title')}</h1>
          {pending > 0 && (
            <span className="bg-warn rounded-full px-2 py-0.5 text-xs font-bold text-white">
              {pending}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className="press shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                background: filter === f.value ? `${f.color}25` : 'var(--surface-2)',
                color: filter === f.value ? f.color : 'var(--surface-2)',
                border: `1px solid ${filter === f.value ? `${f.color}40` : 'var(--surface-2)'}`,
              }}
            >
              {t(f.tKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger flex flex-col gap-3 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {!isLoading && (!data || data.length === 0) && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-4xl">🔄</span>
            <p className="font-semibold">{t('admin.transfers.no_transfers')}</p>
            <p className="text-muted text-xs">
              {filter === 'PENDING'
                ? t('admin.transfers.empty_pending')
                : t('admin.transfers.empty_filter')}
            </p>
          </div>
        )}

        {data?.map((transfer) => (
          <TransferCard key={transfer.id} tr={transfer} onAction={() => void refetch()} />
        ))}
      </div>
    </div>
  );
}
