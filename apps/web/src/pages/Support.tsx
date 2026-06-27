/**
 * SupportPage — студент видит свои тикеты и создаёт новые.
 * Route: /support
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../hooks/useBackButton';

import { useMyTickets, useCreateTicket, type SupportTicket } from '../api/support';
import { SUPPORT_STATUS } from '../lib/status';
import { EmptyState } from '../components/EmptyState';

// ── TicketCard ─────────────────────────────────────────────────────────────────

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const m = SUPPORT_STATUS[ticket.status] ?? SUPPORT_STATUS.OPEN!;
  const date = new Date(ticket.created_at).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="bg-surface border-surface-2 rounded-2xl border p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="flex-1 text-sm font-semibold">{ticket.subject}</p>
        <span
          className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-bold"
          style={{ background: `${m.color}22`, color: m.color }}
        >
          {m.icon} {t(m.labelKey)}
        </span>
      </div>
      <button onClick={() => setExpanded((v) => !v)} className="mb-2 w-full text-left">
        <p className={`text-muted text-xs ${expanded ? '' : 'line-clamp-2'}`}>{ticket.message}</p>
        {!expanded && ticket.message.length > 80 && (
          <span className="text-brand-400 text-xs">{t('support.read_more')}</span>
        )}
      </button>
      <p className="text-faint text-xs">📅 {date}</p>
    </div>
  );
}

// ── Create form bottom sheet ──────────────────────────────────────────────────

function CreateTicketSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateTicket();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  if (!open) return null;

  function handleSend() {
    if (subject.trim().length < 3 || message.trim().length < 10 || create.isPending) return;
    WebApp.HapticFeedback.impactOccurred('medium');
    create.mutate(
      { subject: subject.trim(), message: message.trim() },
      {
        onSuccess: () => {
          setDone(true);
          setTimeout(() => {
            setDone(false);
            setSubject('');
            setMessage('');
            onClose();
          }, 1400);
        },
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="border-brand/20 w-full rounded-t-3xl border p-5 pb-8"
        style={{ background: '#1a2436' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="text-4xl">✅</span>
            <p className="font-bold">{t('support.sent_title')}</p>
            <p className="text-muted text-center text-sm">{t('support.sent_sub')}</p>
          </div>
        ) : (
          <>
            <h3 className="mb-4 text-base font-bold">{t('support.new_ticket')}</h3>

            <div className="mb-3">
              <p className="text-muted mb-1.5 text-xs font-semibold">
                {t('support.subject_label')}
              </p>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t('support.subject_ph')}
                maxLength={120}
                className="bg-surface-2 border-hairline w-full rounded-xl border px-3 py-2.5 text-sm text-white outline-none"
              />
            </div>

            <div className="mb-4">
              <p className="text-muted mb-1.5 text-xs font-semibold">
                {t('support.message_label')}
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('support.message_ph')}
                rows={4}
                maxLength={2000}
                className="bg-surface-2 border-hairline w-full resize-none rounded-xl border px-3 py-2.5 text-sm text-white outline-none"
              />
              <p className="text-faint mt-1 text-right text-xs">{message.length}/2000</p>
            </div>

            <button
              onClick={handleSend}
              disabled={subject.trim().length < 3 || message.trim().length < 10 || create.isPending}
              className="press flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #C8623F, #ECA985)' }}
            >
              {create.isPending ? '...' : t('support.send_btn')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SupportPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyTickets();
  const [showCreate, setShowCreate] = useState(false);

  useBackButton(() => navigate(-1));

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      {/* Header */}
      <div className="glass px-4 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎫</span>
            <div>
              <h1 className="text-lg font-bold">{t('support.title')}</h1>
              <p className="text-muted text-xs">{t('support.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={() => {
              WebApp.HapticFeedback.selectionChanged();
              setShowCreate(true);
            }}
            className="bg-brand/20 text-brand-400 press rounded-xl px-3 py-1.5 text-sm font-semibold"
          >
            {t('support.write_btn')}
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {isError && <EmptyState emoji="⚠️" title={t('support.load_error')} />}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState
            emoji="🎫"
            title={t('support.empty_title')}
            subtitle={t('support.empty_subtitle')}
            action={{ label: t('support.write_manager'), onClick: () => setShowCreate(true) }}
          />
        )}

        <div className="stagger flex flex-col gap-3">
          {data?.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      </div>

      <CreateTicketSheet open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
