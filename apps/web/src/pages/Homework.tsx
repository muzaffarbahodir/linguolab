import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useBackButton } from '../hooks/useBackButton';
import { useMyHomework, useSubmitHomework, type MyHomework } from '../api/homework';
import { EmptyState } from '../components/EmptyState';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadge(submission: MyHomework['my_submission'], due: string | null, t: TFunction) {
  if (!submission) {
    const isOverdue = due ? new Date() > new Date(due) : false;
    return isOverdue
      ? {
          label: t('homework.overdue'),
          cls: 'text-white',
          bg: 'rgba(239,68,68,0.25)',
          border: 'rgba(239,68,68,0.4)',
        }
      : {
          label: t('homework.status_pending'),
          cls: 'text-white',
          bg: 'var(--surface-2)',
          border: 'var(--surface-2)',
        };
  }
  switch (submission.status) {
    case 'GRADED':
      return {
        label: t('homework.status_graded'),
        cls: 'text-white',
        bg: 'rgba(16,185,129,0.25)',
        border: 'rgba(16,185,129,0.4)',
      };
    case 'LATE':
      return {
        label: t('homework.status_late'),
        cls: 'text-white',
        bg: 'rgba(245,158,11,0.25)',
        border: 'rgba(245,158,11,0.4)',
      };
    default:
      return {
        label: t('homework.status_submitted'),
        cls: 'text-white',
        bg: 'rgba(59,130,246,0.25)',
        border: 'rgba(59,130,246,0.4)',
      };
  }
}

function formatDue(due: string | null, t: TFunction, lang: string): string {
  if (!due) return t('homework.no_due');
  const d = new Date(due);
  const now = new Date();
  if (d < now) return t('homework.overdue');
  return t('homework.due', {
    date: d.toLocaleDateString(lang, { day: 'numeric', month: 'short' }),
  });
}

// ─── Submit Sheet ─────────────────────────────────────────────────────────────

function SubmitSheet({ hw, onClose }: { hw: MyHomework; onClose: () => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const submit = useSubmitHomework();

  async function handleSend() {
    if (!text.trim() && !file) return;
    setError('');
    setUploading(true);
    try {
      await submit.mutateAsync({
        homeworkId: hw.id,
        file: file ?? undefined,
        textAnswer: text.trim() || undefined,
      });
      onClose();
    } catch {
      setError(t('homework.submit_error'));
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || submit.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-card w-full rounded-t-3xl px-4 pb-8 pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        <h3 className="mb-4 text-base font-semibold">
          {t('homework.submit_title', { title: hw.title })}
        </h3>

        {/* Text answer */}
        <textarea
          className="bg-surface-2 border-hairline mb-3 w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
          rows={4}
          placeholder={t('homework.answer_ph')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />

        {/* Or divider */}
        <div className="text-muted mb-3 flex items-center gap-2 text-xs">
          <div className="h-px flex-1 bg-white/10" />
          {t('homework.or')}
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* File picker */}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-muted press mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-white/20 py-2.5 text-sm"
          disabled={busy}
        >
          {file ? (
            <span className="text-brand-400 truncate">
              {t('homework.file_attached', { name: file.name })}
            </span>
          ) : (
            <>
              <span>📎</span>
              {t('homework.attach_file')}
            </>
          )}
        </button>

        {error && <p className="text-danger mb-3 text-xs">{error}</p>}

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="glass-option press flex-1 rounded-xl py-3 text-sm"
          >
            {t('homework.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={busy || (!text.trim() && !file)}
            className="glass-btn press flex-1 rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
          >
            {busy
              ? uploading
                ? t('homework.uploading')
                : t('homework.sending')
              : t('homework.send')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Homework Card ─────────────────────────────────────────────────────────────

function HomeworkCard({ hw, onSubmit }: { hw: MyHomework; onSubmit: (hw: MyHomework) => void }) {
  const { t, i18n } = useTranslation();
  const badge = statusBadge(hw.my_submission, hw.due_date, t);
  const dueLabel = formatDue(hw.due_date, t, i18n.language);
  const canSubmit = !hw.my_submission;

  return (
    <div className="glass-card rounded-2xl p-4">
      {/* Header */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-tg-hint text-xs">
            {hw.class.language.flag_emoji} {hw.class.language.name_ru} · {hw.class.title}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold">{hw.title}</h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}
          style={{ background: badge.bg, border: `1px solid ${badge.border}` }}
        >
          {badge.label}
        </span>
      </div>

      {/* Description */}
      {hw.description && <p className="text-tg-hint mb-2 line-clamp-2 text-xs">{hw.description}</p>}

      {/* Due date */}
      <p className="text-tg-hint mb-3 text-xs">{dueLabel}</p>

      {/* Grade + feedback */}
      {hw.my_submission?.grade != null && (
        <div className="bg-ok/15 border-ok/30 mb-3 rounded-xl border px-3 py-2">
          <p className="text-ok text-xs font-semibold">
            {t('homework.grade', { grade: hw.my_submission.grade })}
          </p>
          {hw.my_submission.feedback && (
            <p className="text-ok/80 mt-0.5 text-xs">
              {t('homework.feedback')}: {hw.my_submission.feedback}
            </p>
          )}
        </div>
      )}

      {/* Submit button */}
      {canSubmit && (
        <button
          type="button"
          onClick={() => onSubmit(hw)}
          className="glass-btn press w-full rounded-xl py-2.5 text-sm font-semibold"
        >
          {t('homework.submit_btn')}
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type HwFilter = 'all' | 'active' | 'submitted' | 'overdue';

export function HomeworkPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyHomework();
  const [activeHw, setActiveHw] = useState<MyHomework | null>(null);
  const [filter, setFilter] = useState<HwFilter>('all');

  useBackButton(() => navigate(-1));

  const now = new Date();

  // Counts for tabs
  const counts = {
    all: data?.length ?? 0,
    active:
      data?.filter((hw) => !hw.my_submission && !(hw.due_date && new Date(hw.due_date) < now))
        .length ?? 0,
    submitted: data?.filter((hw) => !!hw.my_submission).length ?? 0,
    overdue:
      data?.filter((hw) => !hw.my_submission && hw.due_date && new Date(hw.due_date) < now)
        .length ?? 0,
  };

  const filtered = data?.filter((hw) => {
    if (filter === 'active')
      return !hw.my_submission && !(hw.due_date && new Date(hw.due_date) < now);
    if (filter === 'submitted') return !!hw.my_submission;
    if (filter === 'overdue')
      return !hw.my_submission && hw.due_date && new Date(hw.due_date) < now;
    return true;
  });

  // Sort: urgent (overdue + active by deadline) first, then submitted
  const sorted = filtered?.slice().sort((a, b) => {
    const aSubmitted = !!a.my_submission;
    const bSubmitted = !!b.my_submission;
    if (aSubmitted !== bSubmitted) return aSubmitted ? 1 : -1;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  const TABS: { key: HwFilter; label: string; color?: string }[] = [
    { key: 'all', label: t('homework.filter_all') },
    { key: 'active', label: t('homework.filter_active'), color: '#C8623F' },
    { key: 'submitted', label: t('homework.filter_submitted'), color: '#10B981' },
    { key: 'overdue', label: t('homework.filter_overdue'), color: '#EF4444' },
  ];

  return (
    <div className="glass-fade-in min-h-screen pb-8">
      {/* Header */}
      <div className="glass px-4 pb-3 pt-6">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">{t('homework.title')}</h1>
        </div>

        {/* Filter tabs */}
        {!isLoading && data && data.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((tab) => {
              const active = filter === tab.key;
              const cnt = counts[tab.key];
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className="press flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: active ? (tab.color ?? '#C8623F') : 'var(--surface-2)',
                    color: active ? '#fff' : 'var(--surface-2)',
                  }}
                >
                  {tab.label}
                  {cnt > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] font-bold ${
                        active ? 'bg-white/25' : 'bg-white/15'
                      }`}
                    >
                      {cnt}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-10">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {isError && <EmptyState emoji="⚠️" title={t('homework.load_error')} />}

        {!isLoading && !isError && data?.length === 0 && (
          <EmptyState emoji="✏️" title={t('homework.empty')} />
        )}

        {!isLoading && !isError && sorted?.length === 0 && (data?.length ?? 0) > 0 && (
          <EmptyState
            emoji="🗂"
            title={
              filter === 'active'
                ? t('homework.empty_active')
                : filter === 'submitted'
                  ? t('homework.empty_submitted')
                  : t('homework.empty_overdue')
            }
          />
        )}

        <div className="stagger space-y-3">
          {sorted?.map((hw) => (
            <HomeworkCard key={hw.id} hw={hw} onSubmit={setActiveHw} />
          ))}
        </div>
      </div>

      {activeHw && <SubmitSheet hw={activeHw} onClose={() => setActiveHw(null)} />}
    </div>
  );
}
