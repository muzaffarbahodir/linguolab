import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Zap, Clock } from 'lucide-react';

import { useAuthStore } from '../store/auth';
import { useUpcomingLesson } from '../api/lessons';
import { useLanguages } from '../api/languages';
import { useProgress, calcProgress } from '../api/users';
import { QuickActionsSheet } from '../components/QuickActionsSheet';
import { RecommendedClasses } from '../components/RecommendedClasses';
import { Button, Card, SectionHeader } from '../components/ui';
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
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[color:var(--text)]">{t('home.progress')}</span>
        <span className="text-brand-400 text-2xl font-bold tabular-nums leading-none">
          {percent}
          <span className="text-base">%</span>
        </span>
      </div>
      <div className="bg-hairline h-2.5 w-full overflow-hidden rounded-full">
        <div
          className="bg-brand h-2.5 rounded-full transition-[width] duration-700 ease-out"
          style={{
            width: `${fill}%`,
            boxShadow: done ? '0 0 12px rgb(var(--brand-rgb)/0.6)' : undefined,
          }}
        />
      </div>
    </Card>
  );
}

function LessonCard() {
  const { t } = useTranslation();
  const { data: lesson, isLoading, isError } = useUpcomingLesson();

  if (isLoading) {
    return (
      <Card>
        <div className="skeleton mb-2 h-4 w-1/3 rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
      </Card>
    );
  }

  if (isError || !lesson) {
    return null;
  }

  const color = lesson.language.color ?? 'rgb(var(--brand-rgb))';

  return (
    // Цвет языка остаётся акцентной полосой слева, но подложка теперь плотная:
    // ближайший урок и так выделен позицией, заливать его цветом не нужно.
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <p className="text-eyebrow text-muted mb-1.5">{t('home.upcoming_lesson')}</p>
      <div className="flex items-center gap-2">
        <span className="text-2xl">{lesson.language.flag_emoji}</span>
        <div>
          <p className="font-semibold">{lesson.language.name_ru}</p>
          <p className="text-muted text-sm">
            {t('home.with_teacher', { name: lesson.teacher.name })}
          </p>
        </div>
      </div>
      <p className="text-muted mt-2 text-xs">
        <Clock size={13} className="mb-0.5 mr-1 inline" />
        {formatLessonTime(lesson.scheduled_at)} · {t('home.min', { n: lesson.duration_minutes })}
      </p>
    </Card>
  );
}

function LanguageScroll() {
  const navigate = useNavigate();
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
        const bg = lang.color ?? 'rgb(var(--brand-rgb))';
        const img = lang.image_url ?? null;
        return (
          <button
            key={lang.id}
            onClick={() => navigate(`/course/${lang.id}`)}
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
      {/* Приветствие — единственный блок с брендовой заливкой на экране,
          поэтому взгляд идёт к нему первым без всяких блюров и орбов. */}
      <Card padding="lg" className="border-brand/20 bg-brand/10">
        <div className="flex items-center gap-3.5">
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
            <p className="text-eyebrow text-muted">{greeting}</p>
            <h1 className="text-display truncate">{firstName}</h1>
          </div>
        </div>
        <p className="text-muted mt-3 text-sm">{t('home.subtitle')}</p>
      </Card>

      <ProgressCard />

      <LessonCard />

      {/* Подбор идёт до общего каталога: человек уже ответил, что ему нужно,
          и показывать сначала всё подряд — значит обесценить его ответы. */}
      <RecommendedClasses />

      <div>
        <SectionHeader title={t('home.available_languages')} />
        <LanguageScroll />
      </div>

      <div className="flex gap-3">
        <Button size="lg" onClick={() => navigate('/book')}>
          {t('home.enroll')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setSheetOpen(true)}
          aria-label={t('home.quick_actions_label')}
          className="h-12 w-12 shrink-0 px-0 py-0"
        >
          <Zap size={20} className="text-brand-400" />
        </Button>
      </div>

      <QuickActionsSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
