/**
 * AttendancePage — студент видит статистику посещаемости по классам.
 * Route: /attendance
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '../hooks/useBackButton';

import { useMyAttendance, type AttendanceStat } from '../api/attendance';
import { EmptyState } from '../components/EmptyState';

// ── AttendanceCard ─────────────────────────────────────────────────────────────

function AttendanceCard({ stat }: { stat: AttendanceStat }) {
  const { t } = useTranslation();
  const pct = stat.attendance_pct;

  const pctColor = pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444';

  const [fill, setFill] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  return (
    <div className="bg-surface border-hairline rounded-2xl border p-4">
      {/* Class header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{stat.language.flag_emoji}</span>
          <div>
            <p className="text-sm font-semibold">{stat.title}</p>
            <p className="text-muted text-xs">{stat.language.name_ru}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold" style={{ color: pctColor }}>
            {pct}%
          </p>
          <p className="text-faint text-xs">{t('attendance.pct_label')}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-hairline mb-3 h-2 w-full overflow-hidden rounded-full">
        <div
          className="h-2 rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${fill}%`, background: pctColor }}
        />
      </div>

      {/* Stats row */}
      <AttendanceChips stat={stat} />

      {stat.excused > 0 && (
        <p className="text-muted mt-2 text-xs">{t('attendance.excused', { n: stat.excused })}</p>
      )}
    </div>
  );
}

function AttendanceChips({ stat }: { stat: AttendanceStat }) {
  const { t } = useTranslation();
  const bg = stat.language.color ?? '#6366f1';
  return (
    <div className="grid grid-cols-4 gap-2">
      <StatChip emoji="📅" label={t('attendance.total')} value={stat.total} color={bg} />
      <StatChip emoji="✅" label={t('attendance.present')} value={stat.present} color="#10B981" />
      <StatChip emoji="⏰" label={t('attendance.late')} value={stat.late} color="#F59E0B" />
      <StatChip emoji="❌" label={t('attendance.absent')} value={stat.absent} color="#EF4444" />
    </div>
  );
}

function StatChip({
  emoji,
  label,
  value,
  color,
}: {
  emoji: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-0.5 rounded-xl py-2"
      style={{ background: `${color}14` }}
    >
      <span className="text-base">{emoji}</span>
      <span className="text-sm font-bold" style={{ color }}>
        {value}
      </span>
      <span className="text-muted text-center text-[10px] leading-tight">{label}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AttendancePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useMyAttendance();

  useBackButton(() => navigate(-1));

  const totalLessons = data?.reduce((s, c) => s + c.total, 0) ?? 0;
  const totalPresent = data?.reduce((s, c) => s + c.present + c.late, 0) ?? 0;
  const overallPct = totalLessons > 0 ? Math.round((totalPresent / totalLessons) * 100) : null;

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      {/* Header */}
      <div className="glass px-4 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📊</span>
          <div>
            <h1 className="text-lg font-bold">{t('attendance.title')}</h1>
            {overallPct !== null && (
              <p className="text-muted text-xs">
                {t('attendance.overall')}:{' '}
                <span
                  className="font-bold"
                  style={{
                    color: overallPct >= 80 ? '#10B981' : overallPct >= 60 ? '#F59E0B' : '#EF4444',
                  }}
                >
                  {overallPct}%
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Reminder hint */}
        <div className="bg-brand/10 border-brand/20 mt-3 flex items-center gap-2 rounded-xl border px-3 py-2">
          <span>🔔</span>
          <p className="text-muted text-xs">{t('attendance.reminder', { hours: 1 })}</p>
        </div>
      </div>

      <div className="px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {isError && <EmptyState emoji="⚠️" title={t('attendance.load_error')} />}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState
            emoji="📊"
            title={t('attendance.no_data')}
            subtitle={t('attendance.no_data_sub')}
          />
        )}

        <div className="stagger flex flex-col gap-3">
          {data?.map((stat) => (
            <AttendanceCard key={stat.classId} stat={stat} />
          ))}
        </div>
      </div>
    </div>
  );
}
