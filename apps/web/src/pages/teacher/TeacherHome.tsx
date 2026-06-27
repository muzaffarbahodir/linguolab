/**
 * TeacherHome — главная страница кабинета учителя.
 *
 * Секции:
 *   1. Уроки сегодня — ближайшие/текущие уроки с кнопкой "Начать урок"
 *   2. ДЗ на проверке — badge с кол-вом + быстрый список
 *   3. Мои классы — компактный список всех классов
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import {
  useMyClasses,
  useTeacherToday,
  useTeacherPendingHw,
  type TodayLesson,
} from '../../api/teacher';
import { useAuthStore } from '../../store/auth';
import { useTeacherProfileByUserId, useUpdateTeacherProfile } from '../../api/teachers';
import { toast } from '../../store/toast';

/** Форматирует время урока из UTC → UTC+5 (Ташкент) */
function fmtTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000);
  return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
}

/** Форматирует сегодняшнюю дату с учётом локали */
function todayLabel(locale: string): string {
  const now = new Date(new Date().getTime() + 5 * 60 * 60 * 1000);
  return now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'long' });
}

// ─── Edit Profile Sheet ───────────────────────────────────────────────────────

function EditProfileSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: profile } = useTeacherProfileByUserId(userId);
  const update = useUpdateTeacherProfile();

  const [bio, setBio] = useState(profile?.bio ?? '');
  const [website, setWebsite] = useState(profile?.website_url ?? '');
  const [instagram, setInstagram] = useState(profile?.instagram_url ?? '');
  const [telegram, setTelegram] = useState(profile?.telegram_url ?? '');
  const [done, setDone] = useState(false);

  // Sync when profile loads (may arrive after mount)
  useEffect(() => {
    if (profile) {
      setBio(profile.bio ?? '');
      setWebsite(profile.website_url ?? '');
      setInstagram(profile.instagram_url ?? '');
      setTelegram(profile.telegram_url ?? '');
    }
  }, [profile]);

  function handleSave() {
    update.mutate(
      {
        bio: bio.trim() || undefined,
        website_url: website.trim() || undefined,
        instagram_url: instagram.trim() || undefined,
        telegram_url: telegram.trim() || undefined,
      },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          setDone(true);
          setTimeout(onClose, 900);
        },
        onError: () => toast.error(t('teacher.save_error')),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/65" onClick={onClose}>
      <div
        className="border-hairline w-full rounded-t-3xl border px-5 pb-10 pt-5"
        style={{ background: '#1a2538' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="text-4xl">✅</span>
            <p className="font-bold text-white">{t('teacher.profile_updated')}</p>
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-base font-bold text-white">{t('teacher.edit_profile')}</h2>

            {/* Bio */}
            <label className="text-muted mb-1 block text-xs font-medium">
              {t('admin.teachers.bio_label')}
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('teacher.bio_ph')}
              rows={3}
              maxLength={500}
              className="bg-surface-2 border-hairline mb-3 w-full resize-none rounded-2xl border px-4 py-3 text-sm text-white outline-none"
            />

            {/* Website */}
            <label className="text-muted mb-1 block text-xs font-medium">
              {t('teacher.website_label')}
            </label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              type="url"
              className="bg-surface-2 border-hairline mb-3 w-full rounded-2xl border px-4 py-2.5 text-sm text-white outline-none"
            />

            {/* Instagram */}
            <label className="text-muted mb-1 block text-xs font-medium">📸 Instagram</label>
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/username"
              type="url"
              className="bg-surface-2 border-hairline mb-3 w-full rounded-2xl border px-4 py-2.5 text-sm text-white outline-none"
            />

            {/* Telegram */}
            <label className="text-muted mb-1 block text-xs font-medium">✈️ Telegram</label>
            <input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="https://t.me/username"
              type="url"
              className="bg-surface-2 border-hairline mb-4 w-full rounded-2xl border px-4 py-2.5 text-sm text-white outline-none"
            />

            <button
              onClick={handleSave}
              disabled={update.isPending}
              className="press w-full rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#6366f1,#a5b4fc)' }}
            >
              {update.isPending ? '...' : t('teacher.save')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function TeacherHomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: todayLessons, isFetching: todayFetching } = useTeacherToday();
  const { data: pendingHw } = useTeacherPendingHw();
  const { data: classes, isLoading: classesLoading } = useMyClasses();
  const [showEdit, setShowEdit] = useState(false);

  const pendingCount = pendingHw?.length ?? 0;

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <p className="text-tg-hint text-xs">{todayLabel(i18n.language)}</p>
          <h1 className="shimmer-brand-text text-xl font-bold">
            {user?.first_name ? t('teacher.hi', { name: user.first_name }) : t('teacher.cabinet')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {todayFetching && (
            <div className="border-brand/30 border-t-brand h-4 w-4 animate-spin rounded-full border-2" />
          )}
          <button
            onClick={() => navigate('/teacher/class-requests')}
            className="bg-surface-2 press flex h-8 w-8 items-center justify-center rounded-full text-sm"
            title="Заявки на курсы"
          >
            📋
          </button>
          <button
            onClick={() => navigate('/teacher/stats')}
            className="bg-surface-2 press flex h-8 w-8 items-center justify-center rounded-full text-sm"
          >
            📊
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="bg-surface-2 press flex h-8 w-8 items-center justify-center rounded-full text-sm"
          >
            ✏️
          </button>
        </div>
      </div>

      {/* ── Today's lessons ────────────────────────────────────────────── */}
      <section className="mb-5">
        <SectionHeader
          emoji="📅"
          title={t('teacher.today')}
          count={todayLessons?.length}
          color="#3B82F6"
        />

        {!todayLessons || todayLessons.length === 0 ? (
          <div className="bg-info/10 border-info/20 rounded-2xl border p-4 text-center">
            <p className="mb-1 text-2xl">🌿</p>
            <p className="text-sm font-semibold">{t('teacher.no_lessons')}</p>
            <p className="text-tg-hint mt-0.5 text-xs">{t('teacher.no_lessons_sub')}</p>
          </div>
        ) : (
          <div className="stagger space-y-3">
            {todayLessons.map((lesson) => (
              <TodayLessonCard
                key={lesson.id}
                lesson={lesson}
                onStart={() => navigate(`/teacher/class/${lesson.class.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Pending homework ───────────────────────────────────────────── */}
      <section className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader
            emoji="📝"
            title={t('teacher.pending_hw')}
            count={pendingCount}
            color="#F59E0B"
          />
          {pendingCount > 0 && (
            <button
              onClick={() => navigate('/teacher/homework')}
              className="text-warn text-xs font-semibold"
            >
              {t('teacher.all_hw')}
            </button>
          )}
        </div>

        {pendingCount === 0 ? (
          <div className="bg-warn/10 border-warn/20 rounded-2xl border p-4 text-center">
            <p className="mb-1 text-2xl">✅</p>
            <p className="text-sm font-semibold">{t('teacher.all_done')}</p>
            <p className="text-tg-hint mt-0.5 text-xs">{t('teacher.no_pending')}</p>
          </div>
        ) : (
          <div className="stagger space-y-2">
            {(pendingHw ?? []).slice(0, 3).map((sub) => (
              <button
                key={sub.id}
                onClick={() => navigate(`/teacher/homework/${sub.homework.id}/submissions`)}
                className="bg-warn/10 border-warn/20 press flex w-full items-center gap-3 rounded-xl border p-3 text-left"
              >
                <span className="text-xl">📄</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">
                    {sub.student.first_name} {sub.student.last_name ?? ''}
                  </p>
                  <p className="text-tg-hint truncate text-xs">
                    {sub.homework.title} · {sub.homework.class.title}
                  </p>
                </div>
                <span className="text-warn text-xs">→</span>
              </button>
            ))}
            {pendingCount > 3 && (
              <button
                onClick={() => navigate('/teacher/homework')}
                className="bg-warn/15 text-warn press w-full rounded-xl py-2 text-xs font-semibold"
              >
                {t('teacher.more_works', { n: pendingCount - 3 })}
              </button>
            )}
          </div>
        )}
      </section>

      {/* ── My classes ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader
          emoji="🎓"
          title={t('teacher.my_classes')}
          count={classes?.length}
          color="#6366f1"
        />

        {classesLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : !classes || classes.length === 0 ? (
          <div className="glass-card rounded-2xl p-6 text-center">
            <p className="mb-2 text-4xl">📚</p>
            <p className="font-semibold">{t('teacher.no_classes')}</p>
            <p className="text-tg-hint mt-1 text-sm">{t('teacher.no_classes_sub')}</p>
          </div>
        ) : (
          <div className="stagger space-y-3">
            {classes.map((cls) => {
              const scheduleDays = cls.schedule_days
                .map((d) => t(`schedule.day_${d.toLowerCase()}`, { defaultValue: d }))
                .join(', ');
              return (
                <button
                  key={cls.id}
                  onClick={() => navigate(`/teacher/class/${cls.id}`)}
                  className="glass-card press w-full overflow-hidden rounded-2xl p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span>{cls.language.flag_emoji}</span>
                        <span className="truncate text-sm font-semibold">{cls.title}</span>
                      </div>
                      <p className="text-tg-hint text-xs">
                        {cls.language.name_ru} · {cls.level}
                        {cls.schedule_days.length > 0 ? ` · ${scheduleDays}` : ''}
                        {cls.schedule_time ? ` ${cls.schedule_time}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-brand text-sm font-bold">
                        {cls.enrolled_count}/{cls.max_students}
                      </span>
                      <span className="text-tg-hint text-xs">{t('teacher.students')}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {showEdit && user && <EditProfileSheet userId={user.id} onClose={() => setShowEdit(false)} />}
    </div>
  );
}

// ── Today lesson card ─────────────────────────────────────────────────────────

function TodayLessonCard({ lesson, onStart }: { lesson: TodayLesson; onStart: () => void }) {
  const { t } = useTranslation();
  const isDone = lesson.status === 'COMPLETED';
  const progress =
    lesson.class.enrolled_count > 0 ? lesson.attendance_count / lesson.class.enrolled_count : 0;
  const progressPct = Math.min(100, Math.round(progress * 100));

  return (
    <div
      className={`rounded-2xl border p-4 ${
        isDone ? 'bg-ok/10 border-ok/20' : 'bg-info/10 border-info/20'
      }`}
    >
      {/* Top row */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="text-lg">{lesson.class.language.flag_emoji}</span>
            <span className="truncate text-sm font-semibold">{lesson.class.title}</span>
          </div>
          <p className="text-tg-hint text-xs">
            🕐 {fmtTime(lesson.scheduled_at)} · {t('schedule.min', { n: lesson.duration_min })}
            {lesson.title ? ` · ${lesson.title}` : ''}
          </p>
        </div>
        {isDone && (
          <span className="bg-ok/15 text-ok whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold">
            {t('teacher.done')}
          </span>
        )}
      </div>

      {/* Attendance progress */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-tg-hint">{t('teacher.attendance')}</span>
          <span className="font-semibold" style={{ color: isDone ? '#10B981' : '#3B82F6' }}>
            {lesson.attendance_count}/{lesson.class.enrolled_count}
          </span>
        </div>
        <div className="bg-hairline h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPct}%`,
              background: isDone ? '#10B981' : '#3B82F6',
            }}
          />
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={onStart}
        className={`press w-full rounded-xl py-2 text-xs font-bold ${
          isDone ? 'bg-ok/15 text-ok' : 'bg-info text-white'
        }`}
      >
        {isDone ? t('teacher.open_class') : t('teacher.start_lesson')}
      </button>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({
  emoji,
  title,
  count,
  color,
}: {
  emoji: string;
  title: string;
  count?: number;
  color: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-base">{emoji}</span>
      <h2 className="text-muted text-xs font-semibold uppercase tracking-wide">{title}</h2>
      {count !== undefined && count > 0 && (
        <span
          className="rounded-full px-1.5 py-0.5 text-xs font-bold"
          style={{ background: `${color}22`, color }}
        >
          {count}
        </span>
      )}
    </div>
  );
}
