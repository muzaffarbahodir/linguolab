/**
 * CourseDetail — страница курса (направления): инфо + что входит + что нужно иметь
 * + список учителей/групп с рекомендованным вариантом. Route: /course/:languageId
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import WebApp from '@twa-dev/sdk';
import {
  Clock,
  Check,
  Star,
  Sparkles,
  Users,
  GraduationCap,
  School,
  Lock,
  PlayCircle,
  FileText,
  ChevronDown,
  Trash2,
  EyeOff,
} from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { useCurrency } from '../hooks/useCurrency';
import {
  useCourseDetail,
  useUpsertReview,
  useDeleteReview,
  useHideReview,
  type CourseClass,
  type TeacherOffer,
  type CourseLesson,
  type CourseReviewItem,
  type MyReview,
} from '../api/languages';
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
  const accent = course?.color ?? '#6366f1';

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
                offlineTrialLanguageId: languageId,
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
      {/* Banner — только фото, без текста (текст ниже, чтобы не мешать фото) */}
      <div className="relative h-44 w-full overflow-hidden">
        {course.image_url ? (
          <img src={course.image_url} alt={course.name_ru} className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)` }}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 pt-4">
        {/* Заголовок под баннером */}
        <div className="flex items-center gap-2.5">
          <span className="text-3xl">{course.flag_emoji}</span>
          <h1 className="text-2xl font-bold">{course.name_ru}</h1>
        </div>

        {data.rating.count > 0 && (
          <div className="-mt-1 flex items-center gap-1.5 text-sm">
            <Star size={15} className="text-warn fill-current" />
            <span className="font-bold">{data.rating.avg}</span>
            <span className="text-faint">({t('course.reviews_n', { n: data.rating.count })})</span>
          </div>
        )}

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

        {/* Программа курса */}
        <CurriculumSection lessons={data.lessons} accent={accent} enrolled={data.enrolled} />

        {/* Пробный урок */}
        <div className="flex gap-2">
          <button
            onClick={guard(() => startTrial('ONLINE'))}
            disabled={requestTrial.isPending}
            className="glass-btn press flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <GraduationCap size={16} />
            {t('course.trial_online_btn')}
          </button>
          <button
            onClick={guard(() => startTrial('OFFLINE'))}
            disabled={requestTrial.isPending}
            className="glass-option press flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            <School size={16} />
            {t('course.trial_offline_btn')}
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

        {/* Готовы учить (офферы учителей без группы) */}
        {data.offers.length > 0 && (
          <div>
            <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
              Готовы учить
            </p>
            <div className="flex flex-col gap-3">
              {data.offers.map((o) => (
                <OfferCard
                  key={o.id}
                  offer={o}
                  onApply={guard(() => startTrial('ONLINE'))}
                  pending={requestTrial.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {/* Отзывы */}
        <ReviewsSection
          languageId={languageId!}
          reviews={data.reviews}
          myReview={data.my_review}
          canReview={data.can_review}
          ratingAvg={data.rating.avg}
          ratingCount={data.rating.count}
        />
      </div>
    </div>
  );
}

function Stars({
  value,
  onPick,
  size = 22,
}: {
  value: number;
  onPick?: (n: number) => void;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(s)}
          className={onPick ? 'press' : ''}
        >
          <Star
            size={size}
            className={s <= value ? 'text-warn fill-current' : 'text-faint'}
            strokeWidth={2}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewsSection({
  languageId,
  reviews,
  myReview,
  canReview,
  ratingAvg,
  ratingCount,
}: {
  languageId: string;
  reviews: CourseReviewItem[];
  myReview: MyReview | null;
  canReview: boolean;
  ratingAvg: number | null;
  ratingCount: number;
}) {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'MANAGER' || role === 'ADMIN' || role === 'SUPER_ADMIN';

  const upsert = useUpsertReview(languageId);
  const del = useDeleteReview(languageId);
  const hide = useHideReview(languageId);

  const [rating, setRating] = useState(myReview?.rating ?? 0);
  const [comment, setComment] = useState(myReview?.comment ?? '');

  const submit = () => {
    if (rating < 1) return;
    upsert.mutate(
      { rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => toast.success(t('course.review_saved')),
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? null;
          toast.error(msg ?? t('app.server_error'));
        },
      },
    );
  };

  const removeMine = () => {
    if (!myReview) return;
    del.mutate(myReview.id, {
      onSuccess: () => {
        setRating(0);
        setComment('');
        toast.success(t('course.review_deleted'));
      },
    });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-muted text-xs font-semibold uppercase tracking-wide">
          {t('course.reviews_title')}
        </p>
        {ratingCount > 0 && (
          <span className="flex items-center gap-1 text-sm font-semibold">
            <Star size={14} className="text-warn fill-current" /> {ratingAvg}
          </span>
        )}
      </div>

      {/* Своя оценка — только для записанных */}
      {canReview && (
        <div className="glass-card mb-3 rounded-2xl p-4">
          <p className="mb-2 text-sm font-semibold">
            {myReview ? t('course.review_edit') : t('course.review_add')}
          </p>
          <Stars value={rating} onPick={setRating} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t('course.review_ph')}
            className="bg-surface-2 border-hairline mt-3 w-full resize-none rounded-xl border px-3 py-2.5 text-sm text-[color:var(--text)] outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={submit}
              disabled={rating < 1 || upsert.isPending}
              className="glass-btn press flex-1 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {upsert.isPending ? '…' : t('course.review_submit')}
            </button>
            {myReview && (
              <button
                onClick={removeMine}
                disabled={del.isPending}
                className="bg-danger/10 text-danger border-danger/25 press rounded-xl border px-4 text-sm font-semibold disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="text-faint py-2 text-sm">{t('course.reviews_empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {reviews.map((r) => (
            <div key={r.id} className="bg-surface border-hairline rounded-2xl border p-3">
              <div className="flex items-center gap-2.5">
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="bg-brand/15 text-brand flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                    {r.author[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.author}</p>
                  <Stars value={r.rating} size={12} />
                </div>
                {isAdmin && (
                  <button
                    onClick={() => hide.mutate({ reviewId: r.id, hidden: true })}
                    className="text-faint press shrink-0"
                    title={t('course.review_hide')}
                  >
                    <EyeOff size={15} />
                  </button>
                )}
              </div>
              {r.comment && <p className="text-muted mt-2 text-sm leading-relaxed">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CurriculumSection({
  lessons,
  accent,
  enrolled,
}: {
  lessons: CourseLesson[];
  accent: string;
  enrolled: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  if (!lessons.length) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-muted text-xs font-semibold uppercase tracking-wide">
          {t('course.curriculum_title')}
        </p>
        <span className="text-faint text-xs">{t('course.lessons_n', { n: lessons.length })}</span>
      </div>
      <div className="glass-card overflow-hidden rounded-2xl">
        {lessons.map((l, i) => {
          const isOpen = open === l.id;
          return (
            <div key={l.id} className={i > 0 ? 'border-hairline border-t' : ''}>
              <button
                onClick={() =>
                  l.unlocked
                    ? setOpen((o) => (o === l.id ? null : l.id))
                    : toast.info(t('course.locked_hint'))
                }
                className="press flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span className="text-faint w-4 text-center text-xs font-bold tabular-nums">
                  {i + 1}
                </span>
                {l.unlocked ? (
                  <PlayCircle size={18} style={{ color: accent }} className="shrink-0" />
                ) : (
                  <Lock size={15} className="text-faint shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.title}</p>
                  <div className="text-faint flex items-center gap-2 text-xs">
                    {l.duration_min ? (
                      <span className="flex items-center gap-0.5">
                        <Clock size={11} /> {t('course.min_n', { n: l.duration_min })}
                      </span>
                    ) : null}
                    {l.materials_count > 0 && (
                      <span>· {t('course.materials_n', { n: l.materials_count })}</span>
                    )}
                  </div>
                </div>
                {l.is_preview && (
                  <span className="bg-ok/15 text-ok shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold">
                    {t('course.preview_free')}
                  </span>
                )}
                {l.unlocked && (
                  <ChevronDown
                    size={15}
                    className="text-faint shrink-0"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
                  />
                )}
              </button>
              {isOpen && l.unlocked && (
                <div className="space-y-2 px-4 pb-3">
                  {l.description && (
                    <p className="text-muted text-xs leading-relaxed">{l.description}</p>
                  )}
                  {l.video_url && (
                    <button
                      onClick={() => WebApp.openLink(l.video_url!)}
                      className="glass-btn press flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold"
                    >
                      <PlayCircle size={14} /> {t('course.watch_video')}
                    </button>
                  )}
                  {l.materials.map((m, mi) => (
                    <button
                      key={mi}
                      onClick={() => WebApp.openLink(m.url)}
                      className="bg-surface-2 press flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs"
                    >
                      <FileText size={14} className="text-faint shrink-0" />
                      <span className="flex-1 truncate">{m.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!enrolled && lessons.some((l) => !l.unlocked) && (
        <p className="text-faint mt-2 text-xs">{t('course.curriculum_locked_hint')}</p>
      )}
    </div>
  );
}

function OfferCard({
  offer,
  onApply,
  pending,
}: {
  offer: TeacherOffer;
  onApply: () => void;
  pending: boolean;
}) {
  const { fmt } = useCurrency();
  const name = `${offer.teacher.user.first_name}${offer.teacher.user.last_name ? ' ' + offer.teacher.user.last_name : ''}`;
  const avatar = offer.teacher.photo_url ?? offer.teacher.user.avatar_url ?? null;
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-3">
        {avatar ? (
          <img src={avatar} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="bg-brand/15 text-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold">
            {name[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{name}</p>
          <div className="text-muted flex items-center gap-2 text-xs">
            {offer.teacher.avg_rating != null && (
              <span className="flex items-center gap-0.5">
                <Star size={12} className="fill-current" style={{ color: '#F5B301' }} />
                {offer.teacher.avg_rating}
              </span>
            )}
            {offer.level && <span>· {offer.level}</span>}
            {offer.format && <span>· {offer.format === 'ONLINE' ? 'онлайн' : 'очно'}</span>}
          </div>
        </div>
        {offer.price_uzs > 0 && (
          <span className="text-brand shrink-0 text-sm font-bold">{fmt(offer.price_uzs)}</span>
        )}
      </div>
      {offer.note && <p className="text-muted mt-2 text-xs leading-relaxed">{offer.note}</p>}
      <button
        onClick={onApply}
        disabled={pending}
        className="glass-btn press mt-3 w-full rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
      >
        Оставить заявку
      </button>
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
