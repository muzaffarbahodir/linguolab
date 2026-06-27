/**
 * MyRequestsPage — единый список обращений студента: пробные уроки, заявки на
 * группу и тикеты поддержки. У каждого — номер (как чек), статус и подсказка
 * «что осталось сделать». Route: /requests
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Inbox, ChevronDown, LifeBuoy, Hash } from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { useMyTrials, useRequestTrial, type TrialType } from '../api/trial-lessons';
import { useMyClassRequests } from '../api/class-requests';
import { useMyTickets } from '../api/support';
import { useLanguages } from '../api/languages';
import { TRIAL_STATUS, SUPPORT_STATUS } from '../lib/status';
import { toast } from '../store/toast';

const REQ_STATUS: Record<string, { color: string; key: string }> = {
  PENDING: { color: '#F59E0B', key: 'profile.req_pending' },
  APPROVED: { color: '#22C55E', key: 'profile.req_approved' },
  REJECTED: { color: '#EF4444', key: 'profile.req_rejected' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** Стабильный 6-значный номер из id (как номер чека): T-000123 / G-... / S-... */
function reqNo(prefix: string, id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `${prefix}-${String(h % 1_000_000).padStart(6, '0')}`;
}

interface Row {
  id: string;
  code: string;
  icon: ReactNode;
  title: string;
  sub: string;
  color: string;
  statusLabel: string;
  next: string;
  date: string;
  note: string | null;
  extra: string | null;
  pay: { trialId: string; classId: string; lang: string } | null;
}

export function MyRequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: trials } = useMyTrials();
  const { data: classReqs } = useMyClassRequests();
  const { data: tickets } = useMyTickets();
  const { data: languages } = useLanguages();
  const requestTrial = useRequestTrial();
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [trialType, setTrialType] = useState<TrialType>('ONLINE');

  useBackButton(() => navigate(-1));

  const submitTrial = (language_id: string) => {
    if (requestTrial.isPending) return;
    requestTrial.mutate(
      { language_id, type: trialType },
      {
        onSuccess: (res) => {
          setPicking(false);
          if (res.needs_payment && res.class_id) {
            navigate('/payment', {
              state: {
                classId: res.class_id,
                classTitle: `${res.language.name_ru} — ${t('profile.trial_offline')}`,
                priceUzs: res.price_uzs,
                offlineTrialLanguageId: language_id,
              },
            });
            return;
          }
          if (res.status === 'CONFIRMED') toast.success(t('profile.trial_online_sent'));
          else toast.success(t('profile.requests_sent'));
        },
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? null;
          toast.error(msg ?? t('app.server_error'));
        },
      },
    );
  };

  const rows: Row[] = [
    ...(trials ?? []).map((tr): Row => {
      const unpaidOffline = tr.type === 'OFFLINE' && tr.status === 'PENDING';
      const m = TRIAL_STATUS[tr.status] ?? TRIAL_STATUS.PENDING!;
      const next = unpaidOffline
        ? t('profile.next_pay')
        : tr.status === 'CONFIRMED'
          ? t('profile.next_done')
          : tr.status === 'CANCELLED'
            ? t('profile.next_closed')
            : t('profile.next_wait_link');
      return {
        id: `t-${tr.id}`,
        code: reqNo('T', tr.id),
        icon: <span className="text-lg">{tr.language.flag_emoji}</span>,
        title: tr.language.name_ru,
        sub: tr.type === 'OFFLINE' ? t('profile.trial_offline') : t('profile.trial_online'),
        color: unpaidOffline ? '#F59E0B' : m.color,
        statusLabel: unpaidOffline ? t('profile.trial_awaiting_pay') : t(m.labelKey),
        next,
        date: tr.created_at,
        note: tr.note ?? null,
        extra: null,
        pay:
          unpaidOffline && tr.class_id
            ? { trialId: tr.id, classId: tr.class_id, lang: tr.language.name_ru }
            : null,
      };
    }),
    ...(classReqs ?? []).map((cr): Row => {
      const m = REQ_STATUS[cr.status] ?? REQ_STATUS.PENDING!;
      const next =
        cr.status === 'APPROVED'
          ? t('profile.next_done')
          : cr.status === 'REJECTED'
            ? t('profile.next_closed')
            : t('profile.next_wait');
      return {
        id: `c-${cr.id}`,
        code: reqNo('G', cr.id),
        icon: <span className="text-lg">{cr.language.flag_emoji}</span>,
        title: cr.title,
        sub: cr.level,
        color: m.color,
        statusLabel: t(m.key),
        next,
        date: cr.created_at,
        note: cr.note ?? null,
        extra: cr.admin_note ?? cr.approved_class?.title ?? null,
        pay: null,
      };
    }),
    ...(tickets ?? []).map((tk): Row => {
      const m = SUPPORT_STATUS[tk.status] ?? SUPPORT_STATUS.OPEN!;
      const next = tk.status === 'CLOSED' ? t('profile.next_closed') : t('profile.next_wait');
      return {
        id: `s-${tk.id}`,
        code: reqNo('S', tk.id),
        icon: <LifeBuoy size={18} className="text-brand-400" strokeWidth={2.2} />,
        title: tk.subject,
        sub: t('profile.support_request'),
        color: m.color,
        statusLabel: t(m.labelKey),
        next,
        date: tk.created_at,
        note: tk.message,
        extra: null,
        pay: null,
      };
    }),
  ].sort((a, b) => +new Date(b.date) - +new Date(a.date));

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-10 pt-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('profile.requests_title')}</h1>
          <p className="text-muted mt-0.5 text-sm">{t('profile.requests_subtitle')}</p>
        </div>
        <button
          onClick={() => setPicking(true)}
          className="bg-brand/20 text-brand-400 press flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-semibold"
        >
          <Plus size={15} strokeWidth={2.6} /> {t('profile.requests_submit')}
        </button>
      </div>

      {rows.length === 0 ? (
        <button
          onClick={() => setPicking(true)}
          className="glass-card press flex w-full flex-col items-center gap-2 rounded-2xl py-10 text-center"
        >
          <Inbox size={30} className="text-faint" strokeWidth={1.8} />
          <p className="text-faint text-sm">{t('profile.requests_empty')}</p>
        </button>
      ) : (
        <div className="stagger flex flex-col gap-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="bg-surface border-hairline overflow-hidden rounded-2xl border"
            >
              <button
                onClick={() => setOpen((o) => (o === r.id ? null : r.id))}
                className="press flex w-full items-center gap-3 px-3 py-3 text-left"
              >
                <div className="bg-surface-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  {r.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="text-faint flex items-center gap-1 text-xs">
                    <Hash size={11} strokeWidth={2.4} />
                    <span className="font-mono">{r.code}</span>
                    <span className="text-faint/60">·</span>
                    {r.sub}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: `${r.color}1f`, color: r.color }}
                >
                  {r.statusLabel}
                </span>
                <ChevronDown
                  size={15}
                  className="text-faint"
                  style={{
                    transform: open === r.id ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
              {open === r.id && (
                <div className="border-hairline space-y-1.5 border-t px-3 py-3 text-xs">
                  <p className="flex items-start gap-1.5" style={{ color: r.color }}>
                    <span className="font-semibold">{t('profile.req_left')}:</span>
                    <span>{r.next}</span>
                  </p>
                  <p className="text-muted">
                    {t('profile.req_date')}:{' '}
                    <span style={{ color: 'var(--text)' }}>{fmtDate(r.date)}</span>
                  </p>
                  {r.note && (
                    <p className="text-muted">
                      {t('profile.req_note')}:{' '}
                      <span style={{ color: 'var(--text)' }}>{r.note}</span>
                    </p>
                  )}
                  {r.extra && <p style={{ color: 'var(--text)' }}>{r.extra}</p>}
                  {r.pay && (
                    <button
                      onClick={() =>
                        navigate('/payment', {
                          state: {
                            classId: r.pay!.classId,
                            classTitle: `${r.pay!.lang} — ${t('profile.trial_offline')}`,
                            trialId: r.pay!.trialId,
                          },
                        })
                      }
                      className="glass-btn press mt-1 w-full rounded-xl py-2 text-xs font-semibold"
                    >
                      {t('profile.trial_pay_now')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Пикер языка для подачи заявки на пробный урок */}
      {picking && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-0"
          onClick={() => setPicking(false)}
        >
          <div
            className="glass-section w-full max-w-lg rounded-t-3xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-bold">{t('profile.requests_pick')}</p>

            <div className="bg-surface-2 mb-3 flex rounded-xl p-1">
              {(['ONLINE', 'OFFLINE'] as TrialType[]).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setTrialType(tp)}
                  className={`press flex-1 rounded-lg py-2 text-xs font-semibold ${
                    trialType === tp ? 'bg-brand/25 text-brand-400' : 'text-faint'
                  }`}
                >
                  {tp === 'ONLINE'
                    ? t('profile.trial_online_free')
                    : t('profile.trial_offline_paid')}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {(languages ?? []).map((lang) => (
                <button
                  key={lang.id}
                  disabled={requestTrial.isPending}
                  onClick={() => submitTrial(lang.id)}
                  className="press bg-surface-2 flex items-center gap-3 rounded-xl px-4 py-3 text-left disabled:opacity-50"
                >
                  <span className="text-xl">{lang.flag_emoji}</span>
                  <span className="flex-1 text-sm font-semibold">{lang.name_ru}</span>
                  <Plus size={16} className="text-brand-400" strokeWidth={2.4} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
