import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import WebApp from '@twa-dev/sdk';

import { useMyEnrollments, type MyEnrollment } from '../api/enrollments';
import {
  useUpcomingLessonsList,
  useAttendanceHistory,
  type UpcomingLessonItem,
  type AttendanceHistoryItem,
} from '../api/lessons';
import { useMyTeacherRating, useTeacherRating, useRateTeacher } from '../api/parents';
import { useRequestTransfer, useMyTransfers } from '../api/teachers';
import { LEVEL_COLOR } from '../lib/status';
import { toast } from '../store/toast';
import { EmptyState } from '../components/EmptyState';
import i18n from '../lib/i18n';

// ─── constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<MyEnrollment['status'], string> = {
  PENDING: '#F59E0B',
  ACTIVE: '#10B981',
  DROPPED: '#EF4444',
};

/** Маппинг ключей дней к JS getDay() */
const DAY_JS: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function getDateLocale(): string {
  return i18n.language;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(getDateLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatSchedule(
  days: string[],
  time: string | null,
  duration: number | null,
  t: TFunction,
): string {
  if (!days.length) return '';
  // Переводим ключи дней через t()
  const DAY_KEYS: Record<string, string> = {
    MON: 'schedule.day_mon',
    TUE: 'schedule.day_tue',
    WED: 'schedule.day_wed',
    THU: 'schedule.day_thu',
    FRI: 'schedule.day_fri',
    SAT: 'schedule.day_sat',
    SUN: 'schedule.day_sun',
  };
  const daysStr = days.map((d) => (DAY_KEYS[d] ? t(DAY_KEYS[d]) : d)).join(', ');
  const parts = [daysStr, time, duration ? t('schedule.min', { n: duration }) : null].filter(
    Boolean,
  );
  return parts.join(' • ');
}

/** Ближайшая дата занятия по расписанию (UTC+5 локальное время) */
function getNextLesson(days: string[], time: string): string | null {
  if (!days.length || !time) return null;
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  const nowUtc = Date.now();
  const nowLocal = new Date(nowUtc + 5 * 3600 * 1000);

  const loc = getDateLocale();

  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(nowLocal);
    candidate.setDate(nowLocal.getDate() + i);
    candidate.setHours(h, m, 0, 0);
    const jsDay = candidate.getDay();
    const key = Object.keys(DAY_JS).find((k) => DAY_JS[k] === jsDay);
    if (key && days.includes(key) && candidate > nowLocal) {
      return (
        candidate.toLocaleDateString(loc, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }) +
        ' ' +
        i18n.t('schedule.time_at') +
        ' ' +
        time
      );
    }
  }
  return null;
}

// ─── AttendanceHistoryCard ────────────────────────────────────────────────────

const ATTEND_CONFIG = {
  PRESENT: {
    icon: '✅',
    tKey: 'schedule.attendance_PRESENT',
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
  },
  LATE: {
    icon: '⏰',
    tKey: 'schedule.attendance_LATE',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
  },
  ABSENT: {
    icon: '❌',
    tKey: 'schedule.attendance_ABSENT',
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.12)',
  },
  EXCUSED: {
    icon: '📝',
    tKey: 'schedule.attendance_EXCUSED',
    color: '#818cf8',
    bg: 'rgba(129,140,248,0.12)',
  },
  NONE: {
    icon: '❓',
    tKey: 'schedule.attendance_none',
    color: 'var(--faint)',
    bg: 'var(--surface-2)',
  },
} as const;

function AttendanceHistoryCard({ lesson }: { lesson: AttendanceHistoryItem }) {
  const { t } = useTranslation();
  const loc = getDateLocale();
  const dt = new Date(lesson.scheduled_at);
  const dtLocal = new Date(dt.getTime() + 5 * 3600 * 1000);
  const timeStr = `${String(dtLocal.getUTCHours()).padStart(2, '0')}:${String(dtLocal.getUTCMinutes()).padStart(2, '0')}`;
  const attendStatus = lesson.attendances[0]?.status ?? 'NONE';
  const cfg = ATTEND_CONFIG[attendStatus] ?? ATTEND_CONFIG.NONE;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-3 py-2.5"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}20` }}
    >
      {/* Date */}
      <div className="flex min-w-[44px] flex-col items-center">
        <span className="text-sm font-bold leading-none">{dtLocal.getUTCDate()}</span>
        <span className="text-tg-hint text-[10px]">
          {dtLocal.toLocaleDateString(loc, { month: 'short' })}
        </span>
        <span className="text-tg-hint text-[10px]">{timeStr}</span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">
          {lesson.class.language.flag_emoji} {lesson.title ?? lesson.class.title}
        </p>
        <p className="text-tg-hint text-[10px]">{lesson.class.language.name_ru}</p>
      </div>

      {/* Status badge */}
      <div className="flex shrink-0 items-center gap-1">
        <span className="text-sm">{cfg.icon}</span>
        <span className="text-[10px] font-medium" style={{ color: cfg.color }}>
          {t(cfg.tKey)}
        </span>
      </div>
    </div>
  );
}

// ─── UpcomingLessonCard ───────────────────────────────────────────────────────

function UpcomingLessonCard({ lesson }: { lesson: UpcomingLessonItem }) {
  const { t } = useTranslation();
  const loc = getDateLocale();
  const dt = new Date(lesson.scheduled_at);
  // Convert UTC → UTC+5 for display
  const dtLocal = new Date(dt.getTime() + 5 * 3600 * 1000);
  const dateStr = dtLocal.toLocaleDateString(loc, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeStr = `${String(dtLocal.getUTCHours()).padStart(2, '0')}:${String(dtLocal.getUTCMinutes()).padStart(2, '0')}`;
  const lang = lesson.class.language;

  return (
    <div
      className="glass-card flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3"
      style={{ borderLeft: `3px solid ${lang.color ?? '#6366f1'}` }}
    >
      {/* Date block */}
      <div className="bg-surface-2 flex min-w-[52px] flex-col items-center justify-center rounded-xl py-2 text-center">
        <span className="text-base font-bold leading-none">{dtLocal.getUTCDate()}</span>
        <span className="text-tg-hint mt-0.5 text-[10px] uppercase">
          {dtLocal.toLocaleDateString(loc, { month: 'short' })}
        </span>
        <span className="mt-1 text-xs font-semibold">{timeStr}</span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="text-sm">{lang.flag_emoji}</span>
          <span className="truncate text-sm font-semibold leading-tight">
            {lesson.title ?? lesson.class.title}
          </span>
        </div>
        <p className="text-tg-hint text-xs">👤 {lesson.class.teacher_name}</p>
        {lesson.duration_min > 0 && (
          <p className="text-tg-hint text-xs">⏱ {t('schedule.min', { n: lesson.duration_min })}</p>
        )}
      </div>

      {/* Weekday badge */}
      <span className="text-tg-hint flex-none text-xs">{dateStr.split(',')[0]}</span>
    </div>
  );
}

// ─── TeacherRatingBlock ───────────────────────────────────────────────────────

function TeacherRatingBlock({ classId }: { classId: string }) {
  const { t } = useTranslation();
  const { data: myRating, isLoading: myLoading } = useMyTeacherRating(classId);
  const { data: ratingData } = useTeacherRating(classId);
  const rateMutation = useRateTeacher(classId);
  const [hovered, setHovered] = useState(0);
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');

  const current = myRating?.rating ?? 0;
  const display = hovered || current;

  const handleRate = (stars: number) => {
    WebApp.HapticFeedback.impactOccurred('light');
    rateMutation.mutate(
      { rating: stars, comment: comment || undefined },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          setShowComment(false);
          setComment('');
        },
      },
    );
  };

  if (myLoading) return null;

  return (
    <div className="border-hairline mt-3 border-t pt-3">
      <div className="flex items-center justify-between">
        <p className="text-muted text-xs font-medium">
          {current ? t('schedule.rating_current') : t('schedule.rating_new')}
        </p>
        {ratingData?.avg_rating != null && (
          <span className="text-faint text-xs">
            ★ {ratingData.avg_rating.toFixed(1)} ({ratingData.total_ratings})
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => {
              if (star === current) {
                setShowComment((p) => !p);
              } else {
                handleRate(star);
              }
            }}
            className="text-2xl transition-transform active:scale-90"
            style={{ color: star <= display ? '#F59E0B' : 'var(--surface-2)' }}
            disabled={rateMutation.isPending}
          >
            ★
          </button>
        ))}
        {current > 0 && <span className="text-faint ml-1 text-xs">{current}/5</span>}
      </div>

      {/* Comment area */}
      {showComment && (
        <div className="mt-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('schedule.comment_ph')}
            rows={2}
            className="border-hairline text-muted w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-xs outline-none"
          />
          <button
            onClick={() => handleRate(current)}
            disabled={rateMutation.isPending}
            className="press mt-1 w-full rounded-xl py-2 text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
          >
            {rateMutation.isPending ? t('schedule.rating_saving') : t('schedule.rate_teacher')}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TransferModal ───────────────────────────────────────────────────────────

function TransferModal({
  fromClassId,
  fromClassTitle,
  onClose,
}: {
  fromClassId: string;
  fromClassTitle: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [toClassId, setToClassId] = useState('');
  const [reason, setReason] = useState('');
  const requestTransfer = useRequestTransfer();

  const { data: myTransfers } = useMyTransfers();
  const hasPending = myTransfers?.some(
    (r) => r.from_class.id === fromClassId && r.status === 'PENDING',
  );

  const handleSubmit = () => {
    if (!toClassId.trim()) return;
    requestTransfer.mutate(
      { from_class_id: fromClassId, to_class_id: toClassId.trim(), reason: reason || undefined },
      {
        onSuccess: () => {
          toast.success(t('schedule.transfer_success'));
          onClose();
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            t('schedule.transfer_error');
          toast.error(msg);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-t-3xl p-6 pb-8" style={{ background: '#1A2535' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold text-white">{t('schedule.transfer_title')}</h2>
          <button
            onClick={onClose}
            className="bg-hairline flex h-8 w-8 items-center justify-center rounded-full text-lg text-white/60"
          >
            ×
          </button>
        </div>

        <p className="text-muted mb-4 text-sm">
          {t('schedule.transfer_from')}{' '}
          <span className="font-semibold text-white">{fromClassTitle}</span>
        </p>

        {hasPending ? (
          <div className="bg-warn/10 text-warn rounded-xl p-3 text-center text-sm">
            {t('schedule.transfer_pending_warn')}
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="text-muted mb-1 block text-xs font-semibold">
                {t('schedule.new_class_id_label')}
              </label>
              <input
                value={toClassId}
                onChange={(e) => setToClassId(e.target.value)}
                placeholder={t('schedule.class_id_ph')}
                className="bg-surface-2 border-hairline w-full rounded-xl border px-3 py-2.5 text-sm text-[color:var(--text)] outline-none"
              />
            </div>
            <div className="mb-4">
              <label className="text-muted mb-1 block text-xs font-semibold">
                {t('schedule.reason_label')}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t('schedule.reason_ph')}
                rows={2}
                className="bg-surface-2 border-hairline w-full resize-none rounded-xl border px-3 py-2.5 text-sm text-[color:var(--text)] outline-none"
              />
            </div>
            <p className="text-faint mb-4 text-xs">{t('schedule.transfer_fee_info')}</p>
            <button
              onClick={handleSubmit}
              disabled={!toClassId.trim() || requestTransfer.isPending}
              className="press w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a5b4fc)' }}
            >
              {requestTransfer.isPending ? '...' : t('schedule.transfer_sending')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── EnrollmentCard ───────────────────────────────────────────────────────────

function EnrollmentCard({ enrollment }: { enrollment: MyEnrollment }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { class: cls, status, enrolled_at } = enrollment;
  const [showTransfer, setShowTransfer] = useState(false);
  const lang = cls.language;
  const teacherName = `${cls.teacher.user.first_name}${cls.teacher.user.last_name ? ' ' + cls.teacher.user.last_name : ''}`;
  const levelColor = LEVEL_COLOR[cls.level] ?? '#6366f1';
  const statusColor = STATUS_COLOR[status];

  const STATUS_LABEL: Record<MyEnrollment['status'], string> = {
    PENDING: t('schedule.status_pending'),
    ACTIVE: t('schedule.status_active'),
    DROPPED: t('schedule.status_dropped'),
  };

  const scheduleStr = formatSchedule(
    cls.schedule_days ?? [],
    cls.schedule_time ?? null,
    cls.schedule_duration ?? null,
    t,
  );
  const nextLesson =
    cls.schedule_days?.length && cls.schedule_time
      ? getNextLesson(cls.schedule_days, cls.schedule_time)
      : null;

  return (
    <div className="glass-card overflow-hidden rounded-2xl">
      <div className="h-1" style={{ backgroundColor: lang.color ?? '#6366f1' }} />
      <div className="p-4">
        {/* Header */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{lang.flag_emoji}</span>
            <span className="text-tg-hint text-xs">{lang.name_ru}</span>
          </div>
          <span
            className="flex-none rounded-full px-2 py-0.5 text-xs font-bold text-white"
            style={{ backgroundColor: levelColor }}
          >
            {cls.level}
          </span>
        </div>

        <h3 className="mb-1 font-semibold leading-tight">{cls.title}</h3>
        <button
          className="text-tg-hint mb-2 flex items-center gap-1 text-xs"
          onClick={() => navigate(`/teachers/${cls.teacher.id}`)}
        >
          👤 {teacherName} <span className="text-faint">›</span>
        </button>

        {/* Расписание */}
        {scheduleStr ? (
          <div className="bg-surface mb-2 rounded-xl px-3 py-2">
            <p className="text-xs font-medium">🗓 {scheduleStr}</p>
            {nextLesson && (
              <p className="text-tg-hint mt-0.5 text-xs">
                {t('schedule.nearest', { date: nextLesson })}
              </p>
            )}
          </div>
        ) : (
          status === 'ACTIVE' && (
            <p className="text-tg-hint mb-2 text-xs italic">{t('schedule.schedule_tbd')}</p>
          )
        )}

        {/* Status + date */}
        <div className="flex items-center justify-between">
          <span
            className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
            style={{ backgroundColor: statusColor }}
          >
            {STATUS_LABEL[status]}
          </span>
          <span className="text-tg-hint text-xs">
            {t('schedule.enrolled_at', { date: formatDate(enrolled_at) })}
          </span>
        </div>

        {/* Pay course — подтверждённая (ACTIVE) запись */}
        {status === 'ACTIVE' && (
          <button
            onClick={() =>
              navigate('/payment', {
                state: {
                  classId: cls.id,
                  classTitle: cls.title,
                  priceUzs: cls.price_uzs,
                },
              })
            }
            className="press mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}
          >
            💳 {t('schedule.pay_course')}
          </button>
        )}

        {/* Teacher rating — only for active enrollments */}
        {status === 'ACTIVE' && <TeacherRatingBlock classId={cls.id} />}

        {/* Transfer request */}
        {status === 'ACTIVE' && (
          <button
            onClick={() => setShowTransfer(true)}
            className="bg-surface text-muted press mt-2 w-full rounded-xl py-2 text-xs font-medium"
          >
            {t('schedule.transfer_btn')}
          </button>
        )}
      </div>
      {showTransfer && (
        <TransferModal
          fromClassId={cls.id}
          fromClassTitle={cls.title}
          onClose={() => setShowTransfer(false)}
        />
      )}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function SchedulePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: enrollments, isLoading, isError } = useMyEnrollments();
  const { data: upcomingLessons = [] } = useUpcomingLessonsList(10);
  const { data: historyLessons = [] } = useAttendanceHistory();
  const [showAllHistory, setShowAllHistory] = useState(false);

  const hasEnrollments = !isLoading && !isError && enrollments && enrollments.length > 0;
  const HISTORY_PREVIEW = 5;
  const visibleHistory = showAllHistory ? historyLessons : historyLessons.slice(0, HISTORY_PREVIEW);

  return (
    <div className="glass-fade-in flex flex-col gap-4 px-4 pb-6 pt-6">
      <h1 className="text-xl font-bold">{t('schedule.title')}</h1>

      {/* ── Upcoming lessons from DB ── */}
      {upcomingLessons.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-tg-hint px-1 text-xs font-semibold uppercase tracking-wide">
            📅 {t('schedule.upcoming_lessons')}
          </p>
          <div className="stagger flex flex-col gap-2">
            {upcomingLessons.map((l) => (
              <UpcomingLessonCard key={l.id} lesson={l} />
            ))}
          </div>
        </section>
      )}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      )}

      {isError && <EmptyState emoji="⚠️" title={t('schedule.load_error')} />}

      {!isLoading && !isError && enrollments?.length === 0 && (
        <EmptyState
          emoji="📚"
          title={t('schedule.empty_title')}
          subtitle={t('schedule.empty_subtitle')}
          action={{ label: t('schedule.enroll'), onClick: () => navigate('/book') }}
        />
      )}

      {hasEnrollments && (
        <>
          <section className="flex flex-col gap-2">
            <p className="text-tg-hint px-1 text-xs font-semibold uppercase tracking-wide">
              🎓 {t('schedule.my_classes')}
            </p>
            <div className="stagger flex flex-col gap-3">
              {enrollments!.map((e) => (
                <EnrollmentCard key={e.id} enrollment={e} />
              ))}
            </div>
          </section>

          <button
            onClick={() => navigate('/book')}
            className="glass-section press w-full rounded-2xl py-3 text-sm font-semibold"
          >
            {t('schedule.enroll_more')}
          </button>
        </>
      )}

      {/* ── Attendance history ── */}
      {historyLessons.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="text-tg-hint px-1 text-xs font-semibold uppercase tracking-wide">
            📋 {t('schedule.history')}
          </p>

          {/* Stats row */}
          {(() => {
            const present = historyLessons.filter(
              (l) => l.attendances[0]?.status === 'PRESENT' || l.attendances[0]?.status === 'LATE',
            ).length;
            const total = historyLessons.length;
            const pct = total > 0 ? Math.round((present / total) * 100) : 0;
            return (
              <div className="bg-surface border-surface-2 flex items-center gap-3 rounded-2xl border px-4 py-3">
                <div className="flex-1">
                  <div className="bg-hairline mb-1 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                  </div>
                  <p className="text-tg-hint text-xs">
                    {t('schedule.history_stat', { present, total })}
                  </p>
                </div>
                <span
                  className="text-sm font-bold"
                  style={{ color: pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444' }}
                >
                  {pct}%
                </span>
              </div>
            );
          })()}

          <div className="stagger flex flex-col gap-1.5">
            {visibleHistory.map((l) => (
              <AttendanceHistoryCard key={l.id} lesson={l} />
            ))}
          </div>

          {historyLessons.length > HISTORY_PREVIEW && (
            <button
              onClick={() => setShowAllHistory((v) => !v)}
              className="text-tg-hint py-1 text-center text-xs active:opacity-70"
            >
              {showAllHistory
                ? t('schedule.history_collapse')
                : t('schedule.history_show_all', { n: historyLessons.length })}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
