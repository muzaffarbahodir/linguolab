/**
 * AdminSupport — менеджер обрабатывает тикеты поддержки.
 * Route: /admin/support
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useAllTickets,
  useUpdateTicketStatus,
  type SupportTicketManager,
  type TicketStatus,
} from '../../api/support';

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_TABS: { key: string | undefined; tKey: string }[] = [
  { key: 'OPEN', tKey: 'admin.support.status_OPEN' },
  { key: undefined, tKey: 'admin.support.filter_all' },
  { key: 'IN_PROGRESS', tKey: 'admin.support.status_IN_PROGRESS' },
  { key: 'CLOSED', tKey: 'admin.support.status_CLOSED' },
];

const STATUS_COLOR: Record<TicketStatus, string> = {
  OPEN: '#EF4444',
  IN_PROGRESS: '#F59E0B',
  CLOSED: '#10B981',
};
const STATUS_TKEY: Record<TicketStatus, string> = {
  OPEN: 'admin.support.status_OPEN',
  IN_PROGRESS: 'admin.support.status_IN_PROGRESS',
  CLOSED: 'admin.support.status_CLOSED',
};

const NEXT_STATUS: Record<TicketStatus, { status: TicketStatus; tKey: string }[]> = {
  OPEN: [
    { status: 'IN_PROGRESS', tKey: 'admin.support.action_in_progress' },
    { status: 'CLOSED', tKey: 'admin.support.action_close' },
  ],
  IN_PROGRESS: [
    { status: 'CLOSED', tKey: 'admin.support.action_close' },
    { status: 'OPEN', tKey: 'admin.support.action_open' },
  ],
  CLOSED: [{ status: 'OPEN', tKey: 'admin.support.action_reopen' }],
};

// ── TicketCard ─────────────────────────────────────────────────────────────────

function TicketCard({ ticket, onAction }: { ticket: SupportTicketManager; onAction: () => void }) {
  const { t, i18n } = useTranslation();
  const update = useUpdateTicketStatus();
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const date = new Date(ticket.created_at).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  function act(status: TicketStatus) {
    if (busy) return;
    WebApp.HapticFeedback.impactOccurred('medium');
    setBusy(true);
    update.mutate(
      { id: ticket.id, status },
      {
        onSuccess: () => {
          setBusy(false);
          onAction();
        },
        onError: () => setBusy(false),
      },
    );
  }

  const color = STATUS_COLOR[ticket.status];
  const actions = NEXT_STATUS[ticket.status];

  return (
    <div className="bg-surface border-hairline rounded-2xl border p-4">
      {/* Header row */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="flex-1 text-sm font-semibold leading-snug">{ticket.subject}</p>
        <span
          className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold"
          style={{ background: `${color}22`, color }}
        >
          {t(STATUS_TKEY[ticket.status])}
        </span>
      </div>

      {/* Student */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="text-xs">👤</span>
        <span className="text-xs font-medium">
          {ticket.student.first_name} {ticket.student.last_name}
        </span>
        {ticket.student.telegram_username && (
          <span className="text-muted text-xs">· @{ticket.student.telegram_username}</span>
        )}
      </div>

      {/* Message preview / expand */}
      <button onClick={() => setExpanded((v) => !v)} className="mb-3 w-full text-left">
        <p className={`text-xs text-white/55 ${expanded ? '' : 'line-clamp-2'}`}>
          {ticket.message}
        </p>
        {!expanded && ticket.message.length > 80 && (
          <span className="text-brand-400 text-xs">{t('admin.support.read_more')}</span>
        )}
      </button>

      {/* Date */}
      <p className="text-faint mb-3 text-xs">📅 {date}</p>

      {/* Actions */}
      <div className="flex gap-2">
        {actions.map((a) => (
          <button
            key={a.status}
            onClick={() => act(a.status)}
            disabled={busy}
            className="press flex-1 rounded-xl py-2 text-xs font-semibold disabled:opacity-40"
            style={{
              background: `${STATUS_COLOR[a.status]}18`,
              color: STATUS_COLOR[a.status],
              border: `1px solid ${STATUS_COLOR[a.status]}33`,
            }}
          >
            {t(a.tKey)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminSupportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | undefined>('OPEN');

  const { data, isLoading, isError, refetch } = useAllTickets(activeTab);

  useBackButton(() => navigate('/admin'));

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      {/* Header */}
      <div className="glass px-4 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎫</span>
          <div>
            <h1 className="text-lg font-bold">{t('admin.support.title')}</h1>
            {data && data.length > 0 && (
              <p className="text-muted text-xs">
                {data.length}{' '}
                {data.length === 1
                  ? t('admin.support.count_1')
                  : data.length < 5
                    ? t('admin.support.count_few')
                    : t('admin.support.count_many')}
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
          <p className="text-muted py-10 text-center text-sm">{t('admin.support.load_error')}</p>
        )}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="bg-brand/10 flex h-20 w-20 items-center justify-center rounded-full text-4xl">
              🎫
            </div>
            <div>
              <p className="font-bold">{t('admin.support.no_tickets')}</p>
              <p className="text-muted mt-1 text-sm">
                {activeTab === 'OPEN'
                  ? t('admin.support.empty_open')
                  : t('admin.support.empty_filter')}
              </p>
            </div>
          </div>
        )}

        <div className="stagger flex flex-col gap-3">
          {data?.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} onAction={() => void refetch()} />
          ))}
        </div>
      </div>
    </div>
  );
}
