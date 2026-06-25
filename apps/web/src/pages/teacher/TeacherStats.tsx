/**
 * TeacherStatsPage — статистика учителя: уроки, студенты, посещаемость, ДЗ.
 * Route: /teacher/stats
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '../../hooks/useBackButton';

import { useTeacherStats, useMyClasses, useClassStudentStats } from '../../api/teacher';

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  emoji,
  value,
  label,
  color,
  sub,
}: {
  emoji: string;
  value: string | number;
  label: string;
  color: string;
  sub?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-2xl py-4"
      style={{ background: `${color}12`, border: `1px solid ${color}25` }}
    >
      <span className="text-2xl">{emoji}</span>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
      </p>
      <p className="text-center text-xs font-medium" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      {sub && (
        <p className="text-[10px]" style={{ color: 'var(--faint)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ── Per-class student stats ───────────────────────────────────────────────────

function ClassStudentStatsCard({ classId, title }: { classId: string; title: string }) {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useClassStudentStats(classId);

  if (isLoading || !stats?.length) return null;

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}
    >
      <p
        className="mb-3 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--faint)' }}
      >
        {title}
      </p>
      <div className="flex flex-col gap-2">
        {stats.map((s) => {
          const pct = s.attendance.pct ?? 0;
          const pctColor = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';
          const name = `${s.student.first_name} ${s.student.last_name ?? ''}`.trim();
          return (
            <div key={s.student.id} className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}
              >
                {s.student.avatar_url ? (
                  <img
                    src={s.student.avatar_url}
                    alt=""
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  name[0]?.toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{name}</p>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full"
                  style={{ background: 'var(--surface-2)' }}
                >
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${pct}%`, background: pctColor }}
                  />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-bold" style={{ color: pctColor }}>
                  {pct}%
                </p>
                <p className="text-[10px]" style={{ color: 'var(--faint)' }}>
                  {s.homework.submitted}/{s.homework.total} {t('homework.title')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TeacherStatsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: stats, isLoading } = useTeacherStats();
  const { data: classes } = useMyClasses();

  useBackButton(() => navigate('/teacher'));

  const attendPct = stats?.avg_attendance_pct ?? 0;
  const attendColor = attendPct >= 80 ? '#10B981' : attendPct >= 60 ? '#F59E0B' : '#EF4444';

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      {/* Header */}
      <div className="glass px-4 pb-4 pt-6" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <h1 className="text-lg font-bold">📊 {t('teacher.stats_title')}</h1>
        <p className="text-xs" style={{ color: 'var(--faint)' }}>
          {t('teacher.my_classes')}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Main stats grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              emoji="🎓"
              value={stats?.classes_count ?? 0}
              label={t('teacher.stats_classes')}
              color="#6C5CE7"
            />
            <StatCard
              emoji="👥"
              value={stats?.total_students ?? 0}
              label={t('teacher.stats_students')}
              color="#3B82F6"
            />
            <StatCard
              emoji="📅"
              value={stats?.total_lessons ?? 0}
              label={t('teacher.stats_lessons')}
              color="#10B981"
            />
            <StatCard
              emoji="📊"
              value={`${attendPct}%`}
              label={t('teacher.stats_attendance')}
              color={attendColor}
            />
          </div>
        )}

        {/* Homework graded */}
        {!isLoading && stats && (
          <div
            className="flex items-center gap-4 rounded-2xl px-5 py-4"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <span className="text-3xl">✅</span>
            <div>
              <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>
                {stats.homework_graded}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('teacher.stats_hw')}
              </p>
            </div>
          </div>
        )}

        {/* Per-class breakdown */}
        {classes && classes.length > 0 && (
          <>
            <p
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--faint)' }}
            >
              {t('teacher.stats_by_class')}
            </p>
            {classes.map((cls) => (
              <ClassStudentStatsCard
                key={cls.id}
                classId={cls.id}
                title={`${cls.language.flag_emoji} ${cls.title}`}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
