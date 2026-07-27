import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { BadgeCheck, GraduationCap, Star } from 'lucide-react';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useTeacherProfile,
  useJoinWaitlist,
  useRateTeacher,
  useMyTeacherRating,
  type TeacherReview,
} from '../../api/teachers';
import { useEnrollClass } from '../../api/classes';
import { useAuthStore } from '../../store/auth';
import { useCurrency } from '../../hooks/useCurrency';
import { toast } from '../../store/toast';
import { extractConflict } from '../../lib/conflict';
import { EmptyState } from '../../components/EmptyState';
import { TeacherIntroVideo } from '../../components/TeacherIntroVideo';
import { Badge, Button, Card, SectionHeader, cx } from '../../components/ui';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarBar({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i + 1 <= Math.round(value);
        return (
          <Star
            key={i}
            size={13}
            className={filled ? 'text-warn' : 'text-faint'}
            fill={filled ? 'currentColor' : 'none'}
          />
        );
      })}
    </div>
  );
}

function StarsHistogram({
  breakdown,
  total,
}: {
  breakdown: { stars: number; count: number }[];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      {[...breakdown].reverse().map(({ stars, count }) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={stars} className="flex items-center gap-2">
            <span className="text-muted w-3 text-right text-xs">{stars}</span>
            <Star size={10} className="text-warn" fill="currentColor" />
            <div className="bg-surface-2 relative h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="bg-warn absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, transition: 'width 0.5s' }}
              />
            </div>
            <span className="text-faint w-5 text-right text-xs">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Плитка статистики: крупная цифра и подпись.
 *
 * Именно эти четыре числа отвечают на «а он вообще преподаёт?» быстрее любого
 * описания, поэтому стоят сразу под именем и читаются одним взглядом.
 */
function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[68px] flex-1 text-center">
      <div className="text-lg font-bold text-[color:var(--text)]">{value}</div>
      <div className="text-faint mt-0.5 text-[11px] leading-tight">{label}</div>
    </div>
  );
}

function Chip({ children, tinted }: { children: React.ReactNode; tinted?: boolean }) {
  return (
    <span
      className={cx(
        'rounded-xl px-2.5 py-1.5 text-xs font-medium',
        tinted ? 'bg-brand/12 text-brand-400' : 'bg-surface-2 text-muted',
      )}
    >
      {children}
    </span>
  );
}

/**
 * Описание с сворачиванием.
 *
 * Преподаватели пишут о себе длинно, и полотно текста отодвигает расписание и
 * цену на второй экран. Показываем начало, остальное — по нажатию.
 */
function AboutBlock({ text }: { text: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const long = text.length > 280;

  return (
    <div>
      <p
        className={cx(
          'text-[color:var(--text)]/80 whitespace-pre-line text-sm leading-relaxed',
          !open && long && 'line-clamp-5',
        )}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-brand-400 press mt-2 text-xs font-semibold"
        >
          {open ? t('teacher.read_less') : t('teacher.read_more')}
        </button>
      )}
    </div>
  );
}

function ReviewRow({ review, locale }: { review: TeacherReview; locale: string }) {
  const date = review.created_at
    ? new Date(review.created_at).toLocaleDateString(locale, { month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="border-hairline border-t pt-3 first:border-t-0 first:pt-0">
      <div className="mb-1.5 flex items-center gap-2">
        {review.author?.avatar_url ? (
          <img
            src={review.author.avatar_url}
            alt=""
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="bg-surface-2 text-muted flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold">
            {review.author?.name?.[0] ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-[color:var(--text)]">
            {review.author?.name}
          </div>
          <div className="text-faint truncate text-[11px]">
            {[review.class_title, date].filter(Boolean).join(' · ')}
          </div>
        </div>
        <StarBar value={review.rating} />
      </div>
      <p className="text-muted text-xs leading-relaxed">{review.comment}</p>
    </div>
  );
}

// ─── Star Picker ─────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex justify-center gap-3">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          onClick={() => {
            onChange(s);
            WebApp.HapticFeedback.selectionChanged();
          }}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          className="press p-1"
          style={{
            transform: s <= active ? 'scale(1.1)' : 'scale(1)',
            transition: 'transform .1s',
          }}
          aria-label={`${s}`}
        >
          <Star
            size={34}
            className={s <= active ? 'text-warn' : 'text-faint'}
            fill={s <= active ? 'currentColor' : 'none'}
          />
        </button>
      ))}
    </div>
  );
}

// ─── Rate Teacher Sheet ───────────────────────────────────────────────────────

function RateTeacherSheet({
  teacherId,
  classes,
  existingRatings,
  onClose,
}: {
  teacherId: string;
  classes: { id: string; title: string; language: { flag_emoji: string } }[];
  existingRatings: { class_id: string; rating: number; comment: string | null }[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rateTeacher = useRateTeacher(teacherId);

  // Если у учителя один класс — выбираем автоматически
  const [selectedClassId, setSelectedClassId] = useState(
    classes.length === 1 ? (classes[0]?.id ?? '') : (existingRatings[0]?.class_id ?? ''),
  );
  const existing = existingRatings.find((r) => r.class_id === selectedClassId);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [done, setDone] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Когда меняется класс — подтягиваем существующую оценку
  useEffect(() => {
    const ex = existingRatings.find((r) => r.class_id === selectedClassId);
    setRating(ex?.rating ?? 0);
    setComment(ex?.comment ?? '');
  }, [selectedClassId, existingRatings]);

  const canSubmit = rating > 0 && selectedClassId;

  function handleSubmit() {
    if (!canSubmit) return;
    rateTeacher.mutate(
      { class_id: selectedClassId, rating, comment: comment.trim() || undefined },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          setDone(true);
          setTimeout(onClose, 1200);
        },
        onError: (err) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message;
          toast.error(
            msg === 'LESSON_NOT_CONDUCTED'
              ? t('teacher.rate_after_lesson')
              : t('teacher.error_must_be_student'),
          );
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="border-hairline bg-surface w-full rounded-t-3xl border px-5 pb-8 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="bg-surface-2 mx-auto mb-4 h-1 w-10 rounded-full" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Star size={44} className="text-warn" fill="currentColor" />
            <p className="text-lg font-bold text-[color:var(--text)]">{t('teacher.rate_thanks')}</p>
            <p className="text-muted text-sm">{t('teacher.rate_thanks_sub')}</p>
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-center text-base font-bold text-[color:var(--text)]">
              {t('teacher.rate_title')}
            </h2>

            {/* Class selector — если классов несколько */}
            {classes.length > 1 && (
              <div className="mb-4">
                <p className="text-muted mb-2 text-xs font-medium">{t('teacher.class_label')}</p>
                <div className="flex flex-col gap-1.5">
                  {classes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClassId(c.id)}
                      className={cx(
                        'press flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors',
                        selectedClassId === c.id
                          ? 'bg-brand/20 border-brand/50 text-brand-400'
                          : 'bg-surface-2 border-hairline text-muted',
                      )}
                    >
                      <span>{c.language.flag_emoji}</span>
                      <span>{c.title}</span>
                      {existingRatings.find((r) => r.class_id === c.id) && (
                        <span className="text-warn ml-auto text-xs">
                          ★ {existingRatings.find((r) => r.class_id === c.id)!.rating}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stars */}
            <div className="mb-1">
              <StarPicker value={rating} onChange={setRating} />
            </div>
            {rating > 0 ? (
              <p className="text-warn mb-4 text-center text-sm font-semibold">
                {(t('teacher.star_labels', { returnObjects: true }) as string[])[rating]}
              </p>
            ) : (
              <div className="mb-4" />
            )}

            {/* Comment */}
            <textarea
              ref={textRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('teacher.comment_ph')}
              rows={3}
              className="bg-surface-2 border-hairline mb-4 w-full resize-none rounded-2xl border px-4 py-3 text-sm text-[color:var(--text)] outline-none"
            />

            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!canSubmit}
              loading={rateTeacher.isPending}
            >
              {existing ? t('teacher.rate_update') : t('teacher.rate_submit')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ClassCard({
  cls,
}: {
  cls: {
    id: string;
    title: string;
    level: string;
    price_uzs: number;
    max_students: number;
    enrolled_count: number;
    spots_left: number;
    is_full: boolean;
    schedule_days: string[] | null;
    schedule_time: string | null;
    schedule_duration: number | null;
    description: string | null;
    language: { flag_emoji: string; name_ru: string; color: string | null };
  };
}) {
  const { t } = useTranslation();
  const enroll = useEnrollClass();
  const joinWaitlist = useJoinWaitlist(cls.id);
  const { fmt } = useCurrency();
  const [done, setDone] = useState(false);

  const onEnrollError = (err: unknown) => {
    const conflict = extractConflict(err);
    toast.error(
      conflict
        ? t('errors.schedule_conflict', { title: conflict.title ?? '…' })
        : t('booking.alert_error'),
    );
  };

  const handleEnroll = () => {
    enroll.mutate(cls.id, { onSuccess: () => setDone(true), onError: onEnrollError });
  };

  const handleWaitlist = () => {
    joinWaitlist.mutate(undefined, { onSuccess: () => setDone(true), onError: onEnrollError });
  };

  const dayLabel = (d: string) => t(`schedule.day_${d.toLowerCase()}`, { defaultValue: d });

  return (
    <Card>
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{cls.language.flag_emoji}</span>
            <span className="font-semibold text-[color:var(--text)]">{cls.title}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone="brand">{cls.level}</Badge>
            <span className="text-faint text-xs">{cls.language.name_ru}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-[color:var(--text)]">{fmt(cls.price_uzs)}</div>
          <div className={cx('text-xs', cls.is_full ? 'text-danger' : 'text-ok')}>
            {cls.is_full ? t('teacher.no_spots') : `${cls.spots_left} / ${cls.max_students}`}
          </div>
        </div>
      </div>

      {/* Schedule */}
      {cls.schedule_days && cls.schedule_days.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {cls.schedule_days.map((d) => (
            <Chip key={d}>{dayLabel(d)}</Chip>
          ))}
          {cls.schedule_time && <Chip>{cls.schedule_time}</Chip>}
          {cls.schedule_duration && (
            <Chip>{t('teacher.minutes', { n: cls.schedule_duration })}</Chip>
          )}
        </div>
      )}

      {cls.description && (
        <p className="text-muted mb-3 text-xs leading-relaxed">{cls.description}</p>
      )}

      {/* CTA */}
      {done ? (
        <div className="bg-ok/15 text-ok rounded-xl py-2.5 text-center text-sm font-semibold">
          {cls.is_full ? t('teacher.in_queue') : t('teacher.request_sent')}
        </div>
      ) : cls.is_full ? (
        <Button
          size="lg"
          variant="secondary"
          onClick={handleWaitlist}
          loading={joinWaitlist.isPending}
        >
          {t('teacher.join_queue')}
        </Button>
      ) : (
        <Button size="lg" onClick={handleEnroll} loading={enroll.isPending}>
          {t('teacher.enroll_btn')}
        </Button>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TeacherProfilePage() {
  const { t, i18n } = useTranslation();
  const { teacherId } = useParams<{ teacherId: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const { data: teacher, isLoading, isError } = useTeacherProfile(teacherId ?? '');
  const { data: myRatings } = useMyTeacherRating(role === 'STUDENT' ? (teacherId ?? '') : '');
  const [showRateSheet, setShowRateSheet] = useState(false);
  const classesRef = useRef<HTMLDivElement>(null);

  useBackButton(() => navigate(-1));

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-brand/30 border-t-brand h-8 w-8 animate-spin rounded-full border-4" />
      </div>
    );
  }

  if (isError || !teacher) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <EmptyState emoji="⚠️" title={t('teacher.not_found')} />
      </div>
    );
  }

  const fullName = `${teacher.user.first_name} ${teacher.user.last_name ?? ''}`.trim();
  const reviews = teacher.recent_reviews ?? [];
  const hasClasses = teacher.classes.length > 0;

  return (
    <div className="glass-fade-in min-h-screen pb-28">
      <div className="space-y-4 px-4 pt-4">
        {/* Видео-визитка — первым экраном, до текста и звёзд */}
        {teacher.intro_video_url && (
          <TeacherIntroVideo
            src={teacher.intro_video_url}
            poster={teacher.intro_video_poster ?? teacher.photo_url}
          />
        )}

        {/* Имя, специализация, страна */}
        <div className="flex items-start gap-3">
          {teacher.photo_url ? (
            <img
              src={teacher.photo_url}
              alt={fullName}
              className="border-hairline h-16 w-16 shrink-0 rounded-2xl border object-cover"
            />
          ) : (
            <div className="bg-brand/15 text-brand-400 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold">
              {teacher.user.first_name[0]}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-xl font-bold text-[color:var(--text)]">{fullName}</h1>
              {teacher.level.verified && (
                <BadgeCheck size={17} className="text-brand-400 shrink-0" />
              )}
            </div>
            {teacher.country && <p className="text-muted mt-0.5 text-xs">{teacher.country}</p>}
            {teacher.headline && (
              <p className="text-[color:var(--text)]/75 mt-1 text-sm leading-snug">
                {teacher.headline}
              </p>
            )}
            <div className="mt-1.5">
              <Badge tone={teacher.level.verified ? 'brand' : 'neutral'}>
                {teacher.level.label}
                {teacher.level.min_votes
                  ? ` · ${t('teacher.votes_needed', { n: teacher.level.min_votes })}`
                  : ''}
              </Badge>
            </div>
          </div>
        </div>

        {/* Четыре числа, по которым выбирают */}
        <Card padding="sm">
          <div className="flex items-start justify-between">
            <StatTile
              value={teacher.avg_rating !== null ? String(teacher.avg_rating) : '—'}
              label={t('teacher.stat_rating')}
            />
            <StatTile value={String(teacher.lessons_conducted)} label={t('teacher.stat_lessons')} />
            <StatTile value={String(teacher.students_count)} label={t('teacher.stat_students')} />
            <StatTile
              value={teacher.experience_years !== null ? String(teacher.experience_years) : '—'}
              label={t('teacher.stat_experience')}
            />
          </div>
        </Card>

        {/* Черты — их ставит менеджер, поэтому это не самоописание */}
        {teacher.highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {teacher.highlights.map((h) => (
              <Chip key={h} tinted>
                {h}
              </Chip>
            ))}
          </div>
        )}

        {/* О преподавателе */}
        {teacher.bio && (
          <div>
            <SectionHeader title={t('teacher.about_title')} />
            <Card>
              <AboutBlock text={teacher.bio} />
            </Card>
          </div>
        )}

        {/* Языки владения */}
        {teacher.speaks.length > 0 && (
          <div>
            <SectionHeader title={t('teacher.speaks_title')} />
            <Card>
              <div className="space-y-2">
                {teacher.speaks.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[color:var(--text)]">{s.name}</span>
                    {s.level && <Badge tone="brand">{s.level}</Badge>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Направления */}
        {teacher.specializations.length > 0 && (
          <div>
            <SectionHeader title={t('teacher.specializations_title')} />
            <div className="flex flex-wrap gap-1.5">
              {teacher.specializations.map((s) => (
                <Chip key={s}>{s}</Chip>
              ))}
            </div>
          </div>
        )}

        {/* Образование */}
        {teacher.education.length > 0 && (
          <div>
            <SectionHeader title={t('teacher.education_title')} />
            <Card>
              <div className="space-y-3">
                {teacher.education.map((e, i) => (
                  <div key={i} className="flex gap-2.5">
                    <GraduationCap size={16} className="text-muted mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[color:var(--text)]">{e.title}</div>
                      {(e.org || e.year) && (
                        <div className="text-faint text-xs">
                          {[e.org, e.year].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Награды центра */}
        {teacher.badges.length > 0 && (
          <div>
            <SectionHeader title={t('teacher.achievements')} />
            <div className="flex flex-wrap gap-2">
              {teacher.badges.map((b) => (
                <div
                  key={b.id}
                  className="bg-surface border-hairline flex items-center gap-2 rounded-xl border px-3 py-2"
                >
                  <span className="text-xl">{b.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-[color:var(--text)]">{b.title}</div>
                    {b.description && <div className="text-faint text-xs">{b.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Отзывы */}
        <div>
          <SectionHeader
            title={t('teacher.reviews_title')}
            hint={
              teacher.ratings_count > 0
                ? t('teacher.ratings_count_n', { n: teacher.ratings_count })
                : undefined
            }
          />
          {teacher.ratings_count > 0 ? (
            <Card>
              <div className="mb-4 flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-black text-[color:var(--text)]">
                    {teacher.avg_rating}
                  </div>
                  <StarBar value={teacher.avg_rating ?? 0} />
                </div>
                <div className="flex-1">
                  <StarsHistogram
                    breakdown={teacher.stars_breakdown}
                    total={teacher.ratings_count}
                  />
                </div>
              </div>

              {reviews.length > 0 ? (
                <div className="space-y-3">
                  {reviews.map((r, i) => (
                    <ReviewRow key={i} review={r} locale={i18n.language} />
                  ))}
                </div>
              ) : (
                <p className="text-faint text-center text-xs">{t('teacher.no_written_reviews')}</p>
              )}
            </Card>
          ) : (
            <Card>
              <p className="text-faint text-center text-xs">{t('teacher.no_ratings')}</p>
            </Card>
          )}
        </div>

        {/* Оценить — только студентам */}
        {role === 'STUDENT' && hasClasses && (
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setShowRateSheet(true)}
            leftIcon={<Star size={15} fill="currentColor" />}
          >
            {myRatings && myRatings.length > 0
              ? t('teacher.your_rating_n', { rating: myRatings[0]?.rating })
              : t('teacher.rate_teacher_btn')}
          </Button>
        )}

        {/* Курсы */}
        <div ref={classesRef} className="scroll-mt-4">
          <SectionHeader title={t('teacher.classes_title')} />
          {hasClasses ? (
            <div className="stagger space-y-3">
              {teacher.classes.map((cls) => (
                <ClassCard key={cls.id} cls={cls} />
              ))}
            </div>
          ) : (
            <EmptyState emoji="📚" title={t('teacher.no_active_classes')} />
          )}
        </div>

        {/* Ссылки — в конце: это дополнение к профилю, а не причина выбрать */}
        {(teacher.website_url || teacher.instagram_url || teacher.telegram_url) && (
          <div className="flex flex-wrap gap-2">
            {teacher.website_url && (
              <a
                href={teacher.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface-2 text-muted rounded-xl px-3 py-1.5 text-xs font-medium"
              >
                {t('teacher.website')}
              </a>
            )}
            {teacher.instagram_url && (
              <a
                href={teacher.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface-2 text-muted rounded-xl px-3 py-1.5 text-xs font-medium"
              >
                Instagram
              </a>
            )}
            {teacher.telegram_url && (
              <a
                href={teacher.telegram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface-2 text-muted rounded-xl px-3 py-1.5 text-xs font-medium"
              >
                Telegram
              </a>
            )}
          </div>
        )}
      </div>

      {/*
        Закреплённая кнопка записи.
        На Preply она видна с любой точки страницы — профиль длинный, и
        заставлять человека, который уже решился, прокручивать обратно вниз
        значит терять его по дороге.
      */}
      {hasClasses && (
        <div
          className="border-hairline bg-surface/95 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <Button
            size="lg"
            onClick={() => classesRef.current?.scrollIntoView({ behavior: 'smooth' })}
          >
            {t('teacher.book_cta')}
          </Button>
        </div>
      )}

      {/* Rate sheet */}
      {showRateSheet && (
        <RateTeacherSheet
          teacherId={teacher.id}
          classes={teacher.classes.map((c) => ({
            id: c.id,
            title: c.title,
            language: { flag_emoji: c.language.flag_emoji },
          }))}
          existingRatings={myRatings ?? []}
          onClose={() => setShowRateSheet(false)}
        />
      )}
    </div>
  );
}
