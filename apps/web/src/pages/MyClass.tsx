/**
 * MyClassPage — «Мои занятия»: путь обучения студента в классе.
 * Статистика (уроки/часы/посещаемость/ученики/рейтинг) + интерактивная
 * дорожная карта по урокам с анимацией. Route: /my-class/:id
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Star,
  Users,
  Clock,
  CalendarCheck,
  BookOpen,
  GraduationCap,
  type LucideIcon,
} from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { useJourney, type JourneyLesson } from '../api/enrollments';
import { EmptyState } from '../components/EmptyState';

const DAY_LABEL: Record<string, string> = {
  MON: 'Пн',
  TUE: 'Вт',
  WED: 'Ср',
  THU: 'Чт',
  FRI: 'Пт',
  SAT: 'Сб',
  SUN: 'Вс',
};

const ATT_COLOR: Record<string, string> = {
  PRESENT: '#22C55E',
  LATE: '#F59E0B',
  ABSENT: '#EF4444',
  EXCUSED: '#3B82F6',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function MyClassPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useJourney(id);
  const [mounted, setMounted] = useState(false);
  const [openLesson, setOpenLesson] = useState<string | null>(null);

  useBackButton(() => navigate('/schedule'));

  useEffect(() => {
    const tmr = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(tmr);
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-4">
        <EmptyState emoji="⚠️" title={t('app.server_error')} />
      </div>
    );
  }

  const { class: cls, stats, lessons } = data;
  const accent = cls.language.color ?? '#6366f1';
  const teacherName = `${cls.teacher.user.first_name}${cls.teacher.user.last_name ? ' ' + cls.teacher.user.last_name : ''}`;
  const pct =
    stats.lessons_total > 0 ? Math.round((stats.lessons_done / stats.lessons_total) * 100) : 0;
  const days = cls.schedule_days.map((d) => DAY_LABEL[d] ?? d).join(', ');

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-10 pt-6">
      {/* Hero */}
      <div className="glass-card overflow-hidden rounded-2xl">
        <div className="h-1.5" style={{ background: accent }} />
        <div className="p-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{cls.language.flag_emoji}</span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold">{cls.title}</h1>
              <p className="text-muted text-xs">
                {cls.language.name_ru} · {cls.level}
                {data.enrollment.is_trial && ` · ${t('myclass.trial')}`}
              </p>
            </div>
            <span
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold text-white"
              style={{ background: accent }}
            >
              {cls.level}
            </span>
          </div>
          <button
            onClick={() => navigate(`/teachers/${cls.teacher.id}`)}
            className="text-muted press mt-2 flex items-center gap-1.5 text-xs"
          >
            <GraduationCap size={13} /> {teacherName}
          </button>
        </div>
      </div>

      {/* Progress overview */}
      <div className="glass-card mt-3 flex items-center gap-4 rounded-2xl p-4">
        <ProgressRing pct={pct} accent={accent} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('myclass.progress')}</p>
          <p className="text-muted mt-0.5 text-xs">
            {t('myclass.lessons_of', { done: stats.lessons_done, total: stats.lessons_total })}
          </p>
          <p className="text-faint mt-0.5 text-xs">
            {t('myclass.hours_of', { done: stats.hours_done, total: stats.hours_total })}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat
          Icon={Users}
          label={t('myclass.students')}
          value={String(data.students_count)}
          color="#3B82F6"
        />
        <Stat
          Icon={CalendarCheck}
          label={t('myclass.attendance')}
          value={stats.attendance_pct != null ? `${stats.attendance_pct}%` : '—'}
          color="#22C55E"
        />
        <Stat
          Icon={Star}
          label={t('myclass.my_rating')}
          value={data.my_rating != null ? `${data.my_rating}/5` : '—'}
          color="#F59E0B"
        />
        <Stat Icon={BookOpen} label={t('myclass.days')} value={days || '—'} color={accent} />
        <Stat
          Icon={Clock}
          label={t('myclass.time')}
          value={cls.schedule_time ?? '—'}
          color="#818cf8"
        />
        <Stat
          Icon={Clock}
          label={t('myclass.left')}
          value={`${Math.max(stats.lessons_total - stats.lessons_done, 0)}`}
          color="#a5b4fc"
        />
      </div>

      {/* Roadmap */}
      <p className="text-muted mb-2 mt-5 text-xs font-semibold uppercase tracking-wide">
        {t('myclass.roadmap')}
      </p>
      {lessons.length === 0 ? (
        <EmptyState emoji="🗺️" title={t('myclass.no_lessons')} />
      ) : (
        <div className="stagger flex flex-col">
          {lessons.map((l, i) => (
            <RoadNode
              key={l.id}
              lesson={l}
              index={i}
              isLast={i === lessons.length - 1}
              accent={accent}
              mounted={mounted}
              open={openLesson === l.id}
              onToggle={() => setOpenLesson((o) => (o === l.id ? null : l.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoadNode({
  lesson,
  index,
  isLast,
  accent,
  mounted,
  open,
  onToggle,
}: {
  lesson: JourneyLesson;
  index: number;
  isLast: boolean;
  accent: string;
  mounted: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const done = lesson.node === 'done';
  const current = lesson.node === 'current';
  const attColor = lesson.attendance ? ATT_COLOR[lesson.attendance] : null;

  return (
    <div className="flex gap-3">
      {/* Bead + connector column */}
      <div className="relative flex w-7 flex-col items-center">
        {/* Bead */}
        <div className="relative z-10 mt-0.5">
          {current && (
            <span
              className="absolute -inset-1 animate-ping rounded-full opacity-60"
              style={{ background: accent }}
            />
          )}
          <div
            className="relative flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
            style={
              done || current
                ? { background: accent, color: '#fff' }
                : {
                    background: 'var(--surface)',
                    border: '2px solid var(--hairline)',
                    color: 'var(--faint)',
                  }
            }
          >
            {done ? <Check size={15} strokeWidth={3} /> : index + 1}
          </div>
        </div>
        {/* Connector */}
        {!isLast && (
          <div className="relative w-0.5 flex-1">
            <div className="bg-hairline absolute inset-0" />
            <div
              className="absolute inset-0 origin-top transition-transform duration-500"
              style={{
                background: accent,
                transform: mounted && done ? 'scaleY(1)' : 'scaleY(0)',
                transitionDelay: `${index * 70}ms`,
              }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <button
        onClick={onToggle}
        className={`mb-2 flex-1 rounded-2xl border p-3 text-left transition-colors ${
          current ? 'border-brand bg-brand/5' : 'bg-surface border-hairline'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold">
            {lesson.title || t('myclass.lesson_n', { n: index + 1 })}
          </p>
          {attColor && (
            <span
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold"
              style={{ background: `${attColor}1f`, color: attColor }}
            >
              {t(`myclass.att_${lesson.attendance!.toLowerCase()}`)}
            </span>
          )}
          {current && (
            <span className="text-brand-400 shrink-0 text-[10px] font-bold uppercase">
              {t('myclass.current')}
            </span>
          )}
        </div>
        <p className="text-faint mt-0.5 text-xs">
          {fmtDate(lesson.scheduled_at)} · {lesson.duration_min} {t('myclass.min')}
        </p>
        {open && (
          <p className="text-muted mt-1.5 text-xs">
            {done
              ? t('myclass.done_hint')
              : current
                ? t('myclass.current_hint')
                : t('myclass.upcoming_hint')}
          </p>
        )}
      </button>
    </div>
  );
}

function ProgressRing({ pct, accent }: { pct: number; accent: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--hairline)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
        {pct}%
      </span>
    </div>
  );
}

function Stat({
  Icon,
  label,
  value,
  color,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-surface border-hairline flex flex-col items-center gap-1 rounded-2xl border p-2.5 text-center">
      <Icon size={16} style={{ color }} />
      <span className="truncate text-sm font-bold" style={{ maxWidth: '100%' }}>
        {value}
      </span>
      <span className="text-faint text-[10px] leading-tight">{label}</span>
    </div>
  );
}
