import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import i18n from '../../lib/i18n';
import { EmptyState } from '../../components/EmptyState';
import {
  useChildOverview,
  useChildAttendance,
  useChildHomework,
  useUnlinkChild,
  type ChildOverview,
  type ChildAttendanceItem,
  type ChildHomeworkItem,
} from '../../api/parents';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ATTEND_CFG: Record<string, { icon: string; color: string; tKey: string }> = {
  PRESENT: { icon: '✅', color: '#10B981', tKey: 'parent.attendance_PRESENT' },
  LATE: { icon: '🕐', color: '#F59E0B', tKey: 'parent.attendance_LATE' },
  ABSENT: { icon: '❌', color: '#EF4444', tKey: 'parent.attendance_ABSENT' },
  EXCUSED: { icon: '📋', color: '#6B7280', tKey: 'parent.attendance_EXCUSED' },
};

const HW_CFG: Record<string, { color: string; bg: string; tKey: string }> = {
  GRADED: { color: '#10B981', bg: 'rgba(16,185,129,0.12)', tKey: 'parent.hw_GRADED' },
  SUBMITTED: { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', tKey: 'parent.hw_SUBMITTED' },
  PENDING: {
    color: 'var(--faint)',
    bg: 'var(--surface-2)',
    tKey: 'parent.hw_PENDING',
  },
  OVERDUE: { color: '#EF4444', bg: 'rgba(239,68,68,0.12)', tKey: 'parent.hw_OVERDUE' },
};

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_COLOR: Record<string, string> = {
  A1: '#10B981',
  A2: '#3B82F6',
  B1: '#E0875A',
  B2: '#F59E0B',
  C1: '#EF4444',
  C2: '#F97316',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(i18n.language, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Donut chart (SVG) ────────────────────────────────────────────────────────

function DonutChart({
  pct,
  size = 88,
  stroke = 10,
  color,
  label,
  sublabel,
}: {
  pct: number | null;
  size?: number;
  stroke?: number;
  color: string;
  label: string;
  sublabel?: string;
}) {
  const val = pct ?? 0;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (val / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct != null ? color : 'var(--surface-2)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{
            fill: '#fff',
            fontSize: size * 0.18,
            fontWeight: 700,
            transform: 'rotate(90deg)',
            transformOrigin: 'center',
          }}
        >
          {pct != null ? `${pct}` : '—'}
        </text>
        {pct != null && (
          <text
            x="50%"
            y="65%"
            textAnchor="middle"
            style={{
              fill: 'var(--surface-2)',
              fontSize: size * 0.12,
              transform: 'rotate(90deg)',
              transformOrigin: 'center',
            }}
          >
            %
          </text>
        )}
      </svg>
      <p className="text-muted text-center text-[10px] font-medium leading-tight">{label}</p>
      {sublabel && <p className="text-faint text-center text-[9px]">{sublabel}</p>}
    </div>
  );
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="text-lg font-bold text-white/60">#{rank}</span>;
}

function StarRating({ value, max = 5 }: { value: number | null; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{
            color: i < Math.round(value ?? 0) ? '#F59E0B' : 'var(--surface-2)',
            fontSize: 14,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

// ─── Shared OverviewContent ───────────────────────────────────────────────────

export function OverviewContent({ data }: { data: ChildOverview }) {
  const { t: tl } = useTranslation();
  const navigate = useNavigate();
  const { stats, upcoming_lesson, last_homework, child, ranking, level_ranking, level } = data;

  const hwPct = stats.hw_total > 0 ? Math.round((stats.hw_submitted / stats.hw_total) * 100) : null;

  const gradePct = stats.avg_grade != null ? Math.min(100, Math.round(stats.avg_grade)) : null;

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* ── 3 Donut Charts ── */}
      <div className="bg-surface border-hairline rounded-2xl border p-4">
        <p className="text-muted mb-4 text-xs font-semibold uppercase tracking-wide">
          {tl('parent.stats_title')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <DonutChart
            pct={stats.attendance_pct}
            color={
              (stats.attendance_pct ?? 0) >= 80
                ? '#10B981'
                : (stats.attendance_pct ?? 0) >= 60
                  ? '#F59E0B'
                  : '#EF4444'
            }
            label={tl('parent.attendance_label')}
            sublabel={`${stats.total_lessons} ${tl('profile.stat_lessons')}`}
          />
          <DonutChart
            pct={gradePct}
            color="#E0875A"
            label={tl('parent.grade_label')}
            sublabel={stats.avg_grade != null ? `${stats.avg_grade}/100` : undefined}
          />
          <DonutChart
            pct={hwPct}
            color="#3B82F6"
            label={tl('parent.hw_label')}
            sublabel={`${stats.hw_submitted}/${stats.hw_total}`}
          />
        </div>

        {/* Month bar */}
        {stats.month_lessons_total > 0 && (
          <div className="border-hairline mt-4 border-t pt-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-muted text-xs">{tl('parent.this_month')}</p>
              <span
                className="text-xs font-bold"
                style={{
                  color:
                    (stats.month_attendance_pct ?? 0) >= 80
                      ? '#10B981'
                      : (stats.month_attendance_pct ?? 0) >= 60
                        ? '#F59E0B'
                        : '#EF4444',
                }}
              >
                {stats.month_attendance_pct ?? 0}%
              </span>
            </div>
            <div className="bg-hairline h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${stats.month_attendance_pct ?? 0}%`,
                  background:
                    (stats.month_attendance_pct ?? 0) >= 80
                      ? '#10B981'
                      : (stats.month_attendance_pct ?? 0) >= 60
                        ? '#F59E0B'
                        : '#EF4444',
                }}
              />
            </div>
            <p className="text-faint mt-1 text-[10px]">
              {tl('parent.lessons_attended', {
                present: stats.month_lessons_present,
                total: stats.month_lessons_total,
              })}
            </p>
          </div>
        )}
      </div>

      {/* ── Class Ranking ── */}
      {ranking && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(251,191,36,0.08))',
            border: '1px solid rgba(245,158,11,0.25)',
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'rgba(245,158,11,0.8)' }}
            >
              {tl('parent.class_rank')}
            </p>
            <RankMedal rank={ranking.rank} />
          </div>
          <p className="text-lg font-bold">
            {tl('parent.place', { n: ranking.rank })}{' '}
            <span className="text-muted text-sm font-normal">
              {tl('parent.of_total', { total: ranking.total })}
            </span>
          </p>
          <p className="text-muted text-xs">
            {ranking.class_title} · {ranking.student_pct}%
          </p>
          <div className="bg-hairline mt-2 h-1.5 overflow-hidden rounded-full">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${100 - ((ranking.rank - 1) / Math.max(ranking.total - 1, 1)) * 100}%`,
                background: 'linear-gradient(90deg,#F59E0B,#FBB724)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Level Ranking ── */}
      {level_ranking && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg,rgba(224,135,90,0.15),rgba(59,130,246,0.08))',
            border: '1px solid rgba(224,135,90,0.25)',
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'rgba(224,135,90,0.9)' }}
            >
              {tl('parent.level_rank')}
              {child.active_classes[0]?.level ? ` (${child.active_classes[0].level})` : ''}
            </p>
            <RankMedal rank={level_ranking.rank} />
          </div>
          <p className="text-lg font-bold">
            {tl('parent.place', { n: level_ranking.rank })}{' '}
            <span className="text-muted text-sm font-normal">
              {tl('parent.of_total', { total: level_ranking.total })}
            </span>
          </p>
          <p className="text-muted text-xs">
            {tl('parent.among_students')} · {level_ranking.pct}%
          </p>
          <div className="bg-hairline mt-2 h-1.5 overflow-hidden rounded-full">
            <div
              className="h-1.5 rounded-full"
              style={{
                width: `${100 - ((level_ranking.rank - 1) / Math.max(level_ranking.total - 1, 1)) * 100}%`,
                background: 'linear-gradient(90deg,#E0875A,#3B82F6)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── CEFR Level ── */}
      {level && level.level && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: `linear-gradient(135deg,${LEVEL_COLOR[level.level] ?? '#C8623F'}22,${LEVEL_COLOR[level.level] ?? '#C8623F'}08)`,
            border: `1px solid ${LEVEL_COLOR[level.level] ?? '#C8623F'}33`,
          }}
        >
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-wide"
            style={{ color: `${LEVEL_COLOR[level.level] ?? '#C8623F'}cc` }}
          >
            {tl('parent.lang_level')}
          </p>
          <div className="flex items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black"
              style={{
                background: `${LEVEL_COLOR[level.level] ?? '#C8623F'}22`,
                color: LEVEL_COLOR[level.level] ?? '#C8623F',
              }}
            >
              {level.level}
            </div>
            <div>
              {level.score != null && (
                <p className="text-muted text-sm">{tl('parent.score', { score: level.score })}</p>
              )}
              <div className="mt-2 flex gap-1">
                {LEVEL_ORDER.map((l) => (
                  <div key={l} className="flex flex-col items-center gap-0.5">
                    <div
                      className="h-1.5 w-6 rounded-full"
                      style={{
                        background:
                          LEVEL_ORDER.indexOf(l) <= LEVEL_ORDER.indexOf(level.level)
                            ? (LEVEL_COLOR[l] ?? '#C8623F')
                            : 'var(--surface-2)',
                      }}
                    />
                    <span
                      className="text-[8px]"
                      style={{
                        color: l === level.level ? LEVEL_COLOR[l] : 'var(--surface-2)',
                        fontWeight: l === level.level ? 700 : 400,
                      }}
                    >
                      {l}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Teacher Info ── */}
      {child.active_classes.length > 0 && (
        <div className="bg-surface border-hairline rounded-2xl border p-4">
          <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wide">
            {tl('parent.teachers')}
          </p>
          <div className="flex flex-col gap-3">
            {child.active_classes.map((cls) => {
              const t = cls.teacher;
              const name = `${t.user.first_name}${t.user.last_name ? ' ' + t.user.last_name : ''}`;
              return (
                <button
                  key={cls.id}
                  className="press flex w-full items-center gap-3 text-left"
                  onClick={() => navigate(`/teachers/${t.id}`)}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#C8623F,#E0875A)' }}
                  >
                    {t.user.avatar_url ? (
                      <img
                        src={t.user.avatar_url}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      name[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="text-muted text-xs">
                      {cls.language.flag_emoji} {cls.title}
                    </p>
                    {t.avg_rating != null && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <StarRating value={t.avg_rating} />
                        <span className="text-warn text-xs font-semibold">
                          {t.avg_rating.toFixed(1)}
                        </span>
                        <span className="text-faint text-[10px]">({t.ratings_count})</span>
                      </div>
                    )}
                    {t.bio && <p className="text-faint mt-0.5 text-xs italic">{t.bio}</p>}
                  </div>
                  <span className="text-faint text-sm">›</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Оплата курсов ребёнка ── */}
      {child.active_classes.length > 0 && (
        <div className="bg-surface border-hairline rounded-2xl border p-4">
          <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wide">
            {tl('parent.pay_title')}
          </p>
          <div className="flex flex-col gap-2">
            {child.active_classes.map((cls) => (
              <div
                key={cls.id}
                className="bg-surface-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {cls.language.flag_emoji} {cls.title}
                  </p>
                  <p className="text-faint text-xs">{cls.level}</p>
                </div>
                <button
                  onClick={() =>
                    navigate('/payment', {
                      state: { classId: cls.id, classTitle: cls.title, studentId: child.id },
                    })
                  }
                  className="press shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}
                >
                  💳 {tl('schedule.pay_course')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming lesson ── */}
      <div className="bg-surface border-hairline rounded-2xl border p-4">
        <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wide">
          {tl('parent.upcoming')}
        </p>
        {upcoming_lesson ? (
          <div className="flex items-center gap-3">
            <div className="bg-brand/15 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl">
              {upcoming_lesson.language.flag_emoji}
            </div>
            <div>
              <p className="font-semibold">{upcoming_lesson.class_title}</p>
              <p className="text-sm text-white/55">
                {fmtDateTime(upcoming_lesson.scheduled_at)} ·{' '}
                {tl('schedule.min', { n: upcoming_lesson.duration_min })}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-muted text-sm">{tl('parent.no_upcoming')}</p>
        )}
      </div>

      {/* ── Last homework ── */}
      <div className="bg-surface border-hairline rounded-2xl border p-4">
        <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wide">
          {tl('parent.last_hw')}
        </p>
        {last_homework ? (
          <div>
            <p className="font-semibold">{last_homework.title}</p>
            <div className="mt-1 flex items-center gap-2">
              {(() => {
                const cfg = last_homework.submission
                  ? (HW_CFG[last_homework.submission.status] ?? HW_CFG['PENDING']!)
                  : last_homework.due_date && new Date(last_homework.due_date) < new Date()
                    ? HW_CFG['OVERDUE']!
                    : HW_CFG['PENDING']!;
                return (
                  <span
                    className="rounded-lg px-2 py-0.5 text-xs font-semibold"
                    style={{ background: cfg.bg, color: cfg.color }}
                  >
                    {tl(cfg.tKey)}
                  </span>
                );
              })()}
              {last_homework.submission?.grade != null && (
                <span className="text-warn text-sm font-bold">
                  {last_homework.submission.grade}/100
                </span>
              )}
            </div>
            {last_homework.due_date && (
              <p className="text-faint mt-1 text-xs">
                {tl('parent.deadline', { date: fmtDate(last_homework.due_date) })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-muted text-sm">{tl('parent.no_hw')}</p>
        )}
      </div>
    </div>
  );
}

// ─── Shared tabs ──────────────────────────────────────────────────────────────

export function AttendanceContent({ data }: { data: ChildAttendanceItem[] }) {
  const { t: tl } = useTranslation();
  if (!data.length) {
    return <EmptyState emoji="📅" title={tl('parent.no_attendance_data')} />;
  }

  const total = data.length;
  const present = data.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
  const pct = Math.round((present / total) * 100);
  const pctColor = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="py-4">
      <div className="bg-surface border-hairline mb-4 rounded-2xl border p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-white/60">
            {tl('parent.attendance_last_n', { n: total })}
          </p>
          <span className="text-lg font-bold" style={{ color: pctColor }}>
            {pct}%
          </span>
        </div>
        <div className="bg-hairline h-2 w-full overflow-hidden rounded-full">
          <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: pctColor }} />
        </div>
        <p className="text-faint mt-1 text-xs">
          {tl('parent.lessons_attended_of', { present, total })}
        </p>
      </div>
      <div className="stagger flex flex-col gap-2">
        {data.map((item) => {
          const cfg = ATTEND_CFG[item.status] ?? {
            icon: '—',
            color: '#6B7280',
            tKey: item.status,
          };
          return (
            <div
              key={item.id}
              className="bg-surface border-surface-2 flex items-center gap-3 rounded-2xl border px-4 py-3"
            >
              <span className="text-xl">{cfg.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.lesson.title || tl('parent.fallback_lesson')}
                </p>
                <p className="text-muted text-xs">
                  {item.lesson.class.language.flag_emoji} {item.lesson.class.title}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold" style={{ color: cfg.color }}>
                  {tl(cfg.tKey)}
                </p>
                <p className="text-faint text-[10px]">{fmtDate(item.lesson.scheduled_at)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HomeworkContent({ data }: { data: ChildHomeworkItem[] }) {
  const { t: tl } = useTranslation();
  const now = new Date();

  if (!data.length) {
    return <EmptyState emoji="📚" title={tl('parent.no_hw')} />;
  }

  return (
    <div className="stagger flex flex-col gap-3 py-4">
      {data.map((hw) => {
        const sub = hw.submissions[0] ?? null;
        const isOverdue = !sub && hw.due_date && new Date(hw.due_date) < now;
        const statusKey = sub?.status ?? (isOverdue ? 'OVERDUE' : 'PENDING');
        const cfg = HW_CFG[statusKey] ?? HW_CFG['PENDING']!;

        return (
          <div
            key={hw.id}
            className="bg-surface rounded-2xl border p-4"
            style={{ borderColor: cfg.bg }}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold leading-tight">{hw.title}</p>
              <span
                className="shrink-0 rounded-lg px-2 py-0.5 text-xs font-semibold"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {tl(cfg.tKey)}
              </span>
            </div>
            <p className="text-muted mt-1 text-xs">📚 {hw.class.title}</p>
            {hw.due_date && (
              <p className={`mt-0.5 text-xs ${isOverdue ? 'text-danger' : 'text-faint'}`}>
                {tl('parent.deadline', { date: fmtDate(hw.due_date) })}
                {isOverdue ? ' ⚠️' : ''}
              </p>
            )}
            {sub?.grade != null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-muted text-xs">{tl('parent.grade_label2')}</span>
                <span className="text-warn font-bold">{sub.grade}/100</span>
              </div>
            )}
            {sub?.feedback && (
              <p className="bg-surface text-muted mt-2 rounded-xl px-3 py-2 text-xs italic leading-relaxed">
                💬 {sub.feedback}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab wrappers for Parent ──────────────────────────────────────────────────

function OverviewTab({ childId }: { childId: string }) {
  const { t: tl } = useTranslation();
  const { data, isLoading, isError } = useChildOverview(childId);

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
      </div>
    );

  if (isError || !data) return <EmptyState emoji="⚠️" title={tl('parent.load_error')} />;

  return <OverviewContent data={data} />;
}

function AttendanceTab({ childId }: { childId: string }) {
  const { data, isLoading } = useChildAttendance(childId);
  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
      </div>
    );
  return <AttendanceContent data={data ?? []} />;
}

function HomeworkTab({ childId }: { childId: string }) {
  const { data, isLoading } = useChildHomework(childId);
  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
      </div>
    );
  return <HomeworkContent data={data ?? []} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'attendance' | 'homework';

export function ParentChildPage() {
  const { t: tl } = useTranslation();
  const { childId } = useParams<{ childId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const unlinkChild = useUnlinkChild();
  const { data: overview } = useChildOverview(childId ?? '');

  useBackButton(() => navigate(-1));

  const childName = overview
    ? `${overview.child.first_name} ${overview.child.last_name ?? ''}`.trim()
    : tl('parent.fallback_child');

  const handleUnlink = () => {
    WebApp.showConfirm(tl('parent.unlink_confirm', { name: childName }), (confirmed) => {
      if (confirmed && childId) {
        unlinkChild.mutate(childId, { onSuccess: () => navigate('/parent') });
      }
    });
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: tl('parent.tab_overview'), icon: '📊' },
    { id: 'attendance', label: tl('parent.tab_attendance'), icon: '📅' },
    { id: 'homework', label: tl('parent.tab_homework'), icon: '📚' },
  ];

  return (
    <div className="glass-fade-in min-h-screen pb-8">
      <div
        className="px-4 pb-3 pt-6"
        style={{ background: 'rgba(22,32,46,0.95)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-lg font-bold">{childName}</h1>
            {overview && (
              <p className="text-muted text-xs">
                {tl('parent.active_classes_count', { n: overview.child.active_classes.length })}
              </p>
            )}
          </div>
          <button
            onClick={handleUnlink}
            className="bg-danger/10 text-danger press rounded-xl px-3 py-1.5 text-xs font-medium"
          >
            {tl('parent.unlink')}
          </button>
        </div>
        <div className="mt-3 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`press flex-1 rounded-xl py-2 text-xs font-semibold transition-colors ${
                tab === t.id ? 'bg-brand text-white' : 'bg-surface-2 text-muted'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-4">
        {!childId ? null : tab === 'overview' ? (
          <OverviewTab childId={childId} />
        ) : tab === 'attendance' ? (
          <AttendanceTab childId={childId} />
        ) : (
          <HomeworkTab childId={childId} />
        )}
      </div>
    </div>
  );
}
