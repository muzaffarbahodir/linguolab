import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useAuthStore } from '../store/auth';
import { useUpcomingLesson } from '../api/lessons';
import { useLanguages } from '../api/languages';
import { useProgress, calcProgress } from '../api/users';
import { useMyTrials, useRequestTrial } from '../api/trial-lessons';
import { QuickActionsSheet } from '../components/QuickActionsSheet';
import { TRIAL_STATUS } from '../lib/status';
import i18n from '../lib/i18n';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getDateLocale(): string {
  return i18n.language;
}

function formatLessonTime(iso: string): string {
  const date = new Date(iso);
  const loc = getDateLocale();
  const day = date.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ProgressCard() {
  const { t } = useTranslation();
  const { data: progress, isLoading } = useProgress();
  const percent = progress ? calcProgress(progress) : 0;

  // Анимация заполнения on-mount: 0 → percent после первого кадра.
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(percent));
    return () => cancelAnimationFrame(id);
  }, [percent]);

  // Прячем прогресс пока студент не начал курс (нет активной записи).
  if (isLoading || !progress || progress.active_enrollments === 0) return null;

  const done = percent >= 100;

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-tg-text text-sm font-medium">{t('home.progress')}</span>
        {isLoading ? (
          <div className="skeleton h-5 w-10 rounded" />
        ) : (
          <span className="text-brand-400 text-2xl font-bold tabular-nums leading-none">
            {percent}
            <span className="text-base">%</span>
          </span>
        )}
      </div>
      <div className="bg-hairline h-2.5 w-full overflow-hidden rounded-full">
        <div
          className="h-2.5 rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${fill}%`,
            background: 'linear-gradient(90deg,#6366f1,#a5b4fc)',
            boxShadow: done ? '0 0 12px rgba(129,140,248,0.6)' : 'none',
          }}
        />
      </div>
    </div>
  );
}

function LessonCard() {
  const { t } = useTranslation();
  const { data: lesson, isLoading, isError } = useUpcomingLesson();

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-4">
        <div className="skeleton mb-2 h-4 w-1/3 rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
      </div>
    );
  }

  if (isError || !lesson) {
    return null;
  }

  const color = lesson.language.color ?? '#6366f1';

  return (
    <div
      className="rounded-2xl p-4"
      style={{ backgroundColor: color + '22', borderLeft: `4px solid ${color}` }}
    >
      <p className="text-tg-hint text-eyebrow mb-1.5">{t('home.upcoming_lesson')}</p>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{lesson.language.flag_emoji}</span>
        <div>
          <p className="font-semibold">{lesson.language.name_ru}</p>
          <p className="text-tg-hint text-sm">
            {t('home.with_teacher', { name: lesson.teacher.name })}
          </p>
        </div>
      </div>
      <p className="text-tg-hint mt-2 text-xs">
        🕐 {formatLessonTime(lesson.scheduled_at)} · {t('home.min', { n: lesson.duration_minutes })}
      </p>
    </div>
  );
}

function LanguageScroll() {
  const { data: languages, isLoading } = useLanguages();

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 w-28 flex-none rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!languages?.length) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {languages.map((lang) => {
        const bg = lang.color ?? '#6366f1';
        const img = lang.image_url ?? null;
        return (
          <button
            key={lang.id}
            className="press shadow-e1 relative flex h-20 w-28 flex-none flex-col items-center justify-end overflow-hidden rounded-2xl p-2 font-medium text-white"
            style={img ? undefined : { backgroundColor: bg }}
          >
            {img && (
              <>
                <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/5" />
              </>
            )}
            <span className="relative text-xs drop-shadow">{lang.name_ru}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── TrialLessonsSection ──────────────────────────────────────────────────────

function TrialLessonsSection() {
  const { t } = useTranslation();
  const { data: languages } = useLanguages();
  const { data: trials, isLoading } = useMyTrials();
  const requestMutation = useRequestTrial();

  const [selectedLang, setSelectedLang] = useState('');
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [sent, setSent] = useState(false);

  const canRequest = !!(
    selectedLang &&
    !trials?.some((tr) => tr.language.id === selectedLang && tr.status === 'PENDING')
  );

  function handleSend() {
    if (!canRequest || requestMutation.isPending) return;
    WebApp.HapticFeedback.impactOccurred('medium');
    requestMutation.mutate(
      { language_id: selectedLang, type: 'ONLINE', note: note.trim() || undefined },
      {
        onSuccess: () => {
          setSent(true);
          setNote('');
          setSelectedLang('');
          setTimeout(() => {
            setSent(false);
            setShowForm(false);
          }, 1400);
        },
      },
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-title">🎯 {t('home.trial_section')}</h2>
        <button
          onClick={() => {
            WebApp.HapticFeedback.selectionChanged();
            setShowForm((v) => !v);
          }}
          className="press bg-brand/15 text-brand-400 rounded-xl px-3 py-1 text-xs font-semibold"
        >
          {showForm ? t('home.trial_hide') : t('home.trial_btn')}
        </button>
      </div>

      {/* Existing trials */}
      {isLoading && <div className="skeleton mb-2 h-12 rounded-2xl" />}
      {!isLoading && trials && trials.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {trials.map((tr) => {
            const m = TRIAL_STATUS[tr.status] ?? TRIAL_STATUS.PENDING!;
            return (
              <div
                key={tr.id}
                className="bg-surface border-surface-2 flex items-center justify-between rounded-2xl border px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{tr.language.flag_emoji}</span>
                  <span className="text-sm font-medium">{tr.language.name_ru}</span>
                </div>
                <span
                  className="rounded-lg px-2 py-0.5 text-xs font-bold"
                  style={{ background: `${m.color}22`, color: m.color }}
                >
                  {m.icon} {t(m.labelKey)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Request form */}
      {showForm && (
        <div className="bg-brand/10 border-brand/20 rounded-2xl border p-4">
          {sent ? (
            <div className="flex flex-col items-center gap-2 py-3">
              <span className="text-3xl">✅</span>
              <p className="text-sm font-semibold">{t('home.trial_sent')}</p>
              <p className="text-muted text-xs">{t('home.trial_sent_sub')}</p>
            </div>
          ) : (
            <>
              <p className="text-muted mb-3 text-xs font-semibold">{t('home.trial_select_lang')}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {languages?.map((lang) => {
                  const bg = lang.color ?? '#6366f1';
                  const active = selectedLang === lang.id;
                  const alreadyPending = trials?.some(
                    (tr) => tr.language.id === lang.id && tr.status === 'PENDING',
                  );
                  return (
                    <button
                      key={lang.id}
                      disabled={!!alreadyPending}
                      onClick={() => {
                        WebApp.HapticFeedback.selectionChanged();
                        setSelectedLang(lang.id);
                      }}
                      className="press flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium"
                      style={{
                        background: active ? bg : `${bg}22`,
                        color: active ? '#fff' : bg,
                        opacity: alreadyPending ? 0.4 : 1,
                        border: `1px solid ${bg}44`,
                      }}
                    >
                      {lang.flag_emoji} {lang.name_ru}
                      {alreadyPending && ' ✓'}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('home.trial_note_ph')}
                rows={2}
                maxLength={300}
                className="bg-surface-2 border-hairline mb-3 w-full resize-none rounded-xl border px-3 py-2 text-sm text-[color:var(--text)] outline-none"
              />

              <button
                onClick={handleSend}
                disabled={!canRequest || requestMutation.isPending}
                className="press flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #a5b4fc)',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                }}
              >
                {requestMutation.isPending ? '...' : t('home.trial_submit')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const tgUser = WebApp.initDataUnsafe?.user;

  const firstName = user?.first_name ?? tgUser?.first_name ?? t('home.student');
  const photo = tgUser?.photo_url;
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t('home.greeting_morning')
      : hour < 18
        ? t('home.greeting_day')
        : t('home.greeting_evening');

  return (
    <div className="stagger flex flex-col gap-5 px-4 pt-6">
      {/* Greeting */}
      <div className="glass-card relative overflow-hidden rounded-3xl px-5 py-6">
        <div className="deco-orb" style={{ background: '#818cf8', top: -50, right: -20 }} />
        <div className="relative flex items-center gap-3.5">
          {photo ? (
            <img
              src={photo}
              alt=""
              className="h-12 w-12 flex-none rounded-full object-cover ring-2 ring-white/10"
            />
          ) : (
            <div className="bg-brand flex h-12 w-12 flex-none items-center justify-center rounded-full text-lg font-bold text-white ring-2 ring-white/10">
              {firstName[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-tg-hint text-eyebrow">{greeting}</p>
            <h1 className="shimmer-brand-text text-display truncate">{firstName}</h1>
          </div>
        </div>
        <p className="text-tg-hint relative mt-3 text-sm">{t('home.subtitle')}</p>
      </div>

      {/* Progress */}
      <ProgressCard />

      {/* Upcoming lesson */}
      <LessonCard />

      {/* Languages */}
      <div>
        <h2 className="text-title mb-3">{t('home.available_languages')}</h2>
        <LanguageScroll />
      </div>

      {/* Trial lesson request */}
      <TrialLessonsSection />

      {/* CTA buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => navigate('/book')}
          className="glass-btn press flex-1 rounded-2xl py-3.5 font-semibold"
        >
          {t('home.enroll')}
        </button>
        <button
          onClick={() => setSheetOpen(true)}
          className="glass-card press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl"
          aria-label={t('home.quick_actions_label')}
        >
          ⚡
        </button>
      </div>

      {/* Quick actions sheet */}
      <QuickActionsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
