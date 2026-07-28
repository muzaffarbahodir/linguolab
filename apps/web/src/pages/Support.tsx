/**
 * SupportPage — студент видит свои тикеты и создаёт новые.
 * Route: /support
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../hooks/useBackButton';

import {
  useMyTickets,
  useCreateTicket,
  type SupportCategory,
  type SupportTicket,
} from '../api/support';
import { SUPPORT_STATUS } from '../lib/status';
import { EmptyState } from '../components/EmptyState';
import { Button, cx } from '../components/ui';

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
        <p className="flex-1 text-sm font-semibold">
          {ticket.category ? t(`support.category.${ticket.category}`) : ticket.subject}
        </p>
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

/**
 * Темы обращений.
 *
 * Заголовок студент придумывал сам, и в базе оседали «вопрос» и «помогите» —
 * по такому полю менеджер не мог ни разобрать очередь, ни увидеть, на что
 * жалуются чаще. Готовый список решает обе задачи и заодно экономит человеку
 * одно поле ввода.
 */
const CATEGORIES: { key: SupportCategory; art: string }[] = [
  { key: 'PAYMENT', art: '💳' },
  { key: 'SCHEDULE', art: '📅' },
  { key: 'TEACHER', art: '🧑‍🏫' },
  { key: 'TECHNICAL', art: '⚙️' },
  { key: 'OTHER', art: '💬' },
];

function CreateTicketSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateTicket();
  const [category, setCategory] = useState<SupportCategory | null>(null);
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);

  if (!open) return null;

  const close = () => {
    setCategory(null);
    setMessage('');
    onClose();
  };

  function handleSend() {
    if (!category || message.trim().length < 10 || create.isPending) return;
    WebApp.HapticFeedback.impactOccurred('medium');
    create.mutate(
      // Заголовок собираем из темы: поле в базе обязательное, а спрашивать
      // его у человека больше незачем.
      { subject: t(`support.category.${category}`), message: message.trim(), category },
      {
        onSuccess: () => {
          setDone(true);
          setTimeout(() => {
            setDone(false);
            close();
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
        style={{ background: 'var(--secondary-bg)' }}
      >
        <div className="bg-[color:var(--text)]/15 mx-auto mb-4 h-1 w-10 rounded-full" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="text-4xl">✅</span>
            <p className="font-bold">{t('support.sent_title')}</p>
            <p className="text-muted text-center text-sm">{t('support.sent_sub')}</p>
          </div>
        ) : (
          <>
            <h3 className="mb-4 text-base font-bold">{t('support.new_ticket')}</h3>

            <div className="mb-4">
              <p className="text-muted mb-2 text-xs font-semibold">{t('support.category_label')}</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(({ key, art }) => (
                  <button
                    key={key}
                    onClick={() => {
                      WebApp.HapticFeedback.selectionChanged();
                      setCategory(key);
                    }}
                    aria-pressed={category === key}
                    className={cx(
                      'press rounded-xl border px-3 py-2 text-sm font-medium transition-colors',
                      category === key
                        ? 'bg-brand/20 border-brand text-brand-400'
                        : 'bg-surface-2 border-hairline text-muted',
                    )}
                  >
                    <span className="mr-1.5">{art}</span>
                    {t(`support.category.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Поле сообщения появляется после выбора темы: так человеку видно,
                что от него хотят по шагам, а не сразу целая анкета. */}
            {category && (
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
                  autoFocus
                  className="bg-surface-2 border-hairline w-full resize-none rounded-xl border px-3 py-2.5 text-sm text-[color:var(--text)] outline-none"
                />
                <p className="text-faint mt-1 text-right text-xs">{message.length}/2000</p>
              </div>
            )}

            <Button
              size="lg"
              onClick={handleSend}
              disabled={!category || message.trim().length < 10}
              loading={create.isPending}
            >
              {t('support.send_btn')}
            </Button>
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

        {/* Без кнопки: «Написать» уже стоит в шапке и никуда не девается при
            прокрутке. Две одинаковые кнопки на одном экране только сбивают. */}
        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState
            emoji="🎫"
            title={t('support.empty_title')}
            subtitle={t('support.empty_subtitle')}
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
