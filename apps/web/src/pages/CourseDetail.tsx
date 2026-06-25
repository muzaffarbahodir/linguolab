/**
 * CourseDetail — страница курса (направления): инфо + что входит + что нужно иметь
 * + список учителей/групп с рекомендованным вариантом. Route: /course/:languageId
 */
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, Check, Star, Sparkles, Users } from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { useCurrency } from '../hooks/useCurrency';
import { useCourseDetail, type CourseClass } from '../api/languages';
import { useRequestTrial } from '../api/trial-lessons';
import { useAuthStore } from '../store/auth';
import { LEVEL_COLOR } from '../lib/status';
import { toast } from '../store/toast';
import { EmptyState } from '../components/EmptyState';

export function CourseDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { languageId } = useParams<{ languageId: string }>();
  const { data, isLoading, isError } = useCourseDetail(languageId);
  const requestTrial = useRequestTrial();
  const isActive = useAuthStore((s) => s.user?.is_active);

  useBackButton(() => navigate('/courses'));

  const needsOnboard = isActive === false;
  const guard = (fn: () => void) => () => (needsOnboard ? navigate('/onboard') : fn());

  const course = data?.course;
  const accent = course?.color ?? '#6C5CE7';

  const startTrial = (type: 'ONLINE' | 'OFFLINE') => {
    if (!languageId || requestTrial.isPending) return;
    requestTrial.mutate(
      { language_id: languageId, type },
      {
        onSuccess: (res) => {
          if (res.needs_payment && res.class_id) {
            navigate('/payment', {
              state: {
                classId: res.class_id,
                classTitle: `${res.language.name_ru} — ${t('profile.trial_offline')}`,
                priceUzs: res.price_uzs,
                trialId: res.id,
              },
            });
            return;
          }
          toast.success(
            res.status === 'CONFIRMED'
              ? t('profile.trial_online_sent')
              : t('profile.requests_sent'),
          );
        },
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? null;
          toast.error(msg ?? t('app.server_error'));
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="skeleton h-40 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-44 rounded-2xl" />
      </div>
    );
  }

  if (isError || !course) {
    return (
      <div className="p-4">
        <EmptyState emoji="⚠️" title={t('courses.load_error')} />
      </div>
    );
  }

  return (
    <div className="glass-fade-in pb-10">
      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden">
        {course.image_url ? (
          <img src={course.image_url} alt={course.name_ru} className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-0 left-0 p-4">
          <p className="text-3xl">{course.flag_emoji}</p>
          <h1 className="text-2xl font-bold text-white drop-shadow">{course.name_ru}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4">
        {course.description && (
          <p className="text-muted text-sm leading-relaxed">{course.description}</p>
        )}

        {course.duration_label && (
          <div className="glass-card flex items-center gap-2 rounded-2xl p-3">
            <Clock size={18} style={{ color: accent }} />
            <span className="text-sm font-semibold">{course.duration_label}</span>
          </div>
        )}

        {/* Что входит */}
        {!!course.includes?.length && (
          <div className="glass-card rounded-2xl p-4">
            <p className="mb-2 text-sm font-bold">{t('course.includes_title')}</p>
            <ul className="flex flex-col gap-1.5">
              {course.includes.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check size={16} className="text-ok mt-0.5 shrink-0" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Что нужно иметь */}
        {!!course.requirements?.length && (
          <div className="glass-card rounded-2xl p-4">
            <p className="mb-2 text-sm font-bold">{t('course.requirements_title')}</p>
            <ul className="flex flex-col gap-1.5">
              {course.requirements.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0" style={{ color: accent }}>
                    •
                  </span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Пробный урок */}
        <div className="flex gap-2">
          <button
            onClick={guard(() => startTrial('ONLINE'))}
            disabled={requestTrial.isPending}
            className="glass-btn press flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            🎓 {t('course.trial_online_btn')}
          </button>
          <button
            onClick={guard(() => startTrial('OFFLINE'))}
            disabled={requestTrial.isPending}
            className="glass-option press flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            🏫 {t('course.trial_offline_btn')}
          </button>
        </div>

        {/* Учителя / группы */}
        <div>
          <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
            {t('course.teachers_title')}
          </p>
          {data.classes.length === 0 ? (
            <EmptyState emoji="📭" title={t('course.no_groups')} />
          ) : (
            <div className="flex flex-col gap-3">
              {data.classes.map((c) => (
                <TeacherClassCard
                  key={c.id}
                  cls={c}
                  accent={accent}
                  recommended={c.id === data.recommended_class_id}
                  onEnroll={guard(() =>
                    navigate('/payment', {
                      state: { classId: c.id, classTitle: c.title, priceUzs: c.price_uzs },
                    }),
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeacherClassCard({
  cls,
  accent,
  recommended,
  onEnroll,
}: {
  cls: CourseClass;
  accent: string;
  recommended: boolean;
  onEnroll: () => void;
}) {
  const { t } = useTranslation();
  const { fmt, currency } = useCurrency();
  const teacherName = `${cls.teacher.user.first_name}${cls.teacher.user.last_name ? ' ' + cls.teacher.user.last_name : ''}`;
  const levelColor = LEVEL_COLOR[cls.level] ?? accent;
  const isFull = cls.spots_left <= 0;
  const price = currency === 'USD' && cls.price_usd > 0 ? `$${cls.price_usd}` : fmt(cls.price_uzs);

  return (
    <div
      className="glass-card overflow-hidden rounded-2xl"
      style={
        recommended
          ? { border: `1.5px solid ${accent}`, boxShadow: `0 4px 20px ${accent}33` }
          : undefined
      }
    >
      {recommended && (
        <div
          className="flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white"
          style={{ background: accent }}
        >
          <Sparkles size={13} /> {t('course.recommended')}
        </div>
      )}
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2.5">
          {cls.teacher.user.avatar_url || cls.teacher.photo_url ? (
            <img
              src={cls.teacher.user.avatar_url ?? cls.teacher.photo_url ?? ''}
              alt={teacherName}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ background: accent }}
            >
              {cls.teacher.user.first_name[0]}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{teacherName}</p>
            <div className="flex items-center gap-2 text-xs">
              {cls.teacher.avg_rating != null ? (
                <span className="text-warn flex items-center gap-0.5">
                  <Star size={12} fill="currentColor" /> {cls.teacher.avg_rating}
                  <span className="text-faint">({cls.teacher.ratings_count})</span>
                </span>
              ) : (
                <span className="text-faint">{t('course.no_rating')}</span>
              )}
            </div>
          </div>
          <span
            className="flex-none rounded-full px-2 py-0.5 text-xs font-bold text-white"
            style={{ backgroundColor: levelColor }}
          >
            {cls.level}
          </span>
        </div>

        <p className="mb-1 text-sm font-semibold">{cls.title}</p>

        <div className="text-muted mb-3 flex items-center gap-1 text-xs">
          <Users size={13} />
          {isFull ? (
            <span className="text-warn">{t('courses.waitlist')}</span>
          ) : (
            <span>{t('courses.spots', { n: cls.spots_left, max: cls.max_students })}</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="font-bold" style={{ color: accent }}>
            {price}
            <span className="text-faint text-xs font-normal">{t('courses.per_month')}</span>
          </p>
          <button
            onClick={onEnroll}
            className="press rounded-xl px-5 py-2 text-sm font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
          >
            {t('course.enroll_pay')}
          </button>
        </div>
      </div>
    </div>
  );
}
