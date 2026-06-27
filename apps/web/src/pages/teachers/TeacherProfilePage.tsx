import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useTeacherProfile,
  useJoinWaitlist,
  useRateTeacher,
  useMyTeacherRating,
} from '../../api/teachers';
import { useEnrollClass } from '../../api/classes';
import { useAuthStore } from '../../store/auth';
import { useCurrency } from '../../hooks/useCurrency';
import { toast } from '../../store/toast';
import { EmptyState } from '../../components/EmptyState';

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarBar({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i + 1 <= Math.round(value);
        return (
          <span key={i} style={{ color: filled ? '#F59E0B' : 'var(--surface-2)', fontSize: 14 }}>
            ★
          </span>
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
            <span className="text-warn text-[11px]">★</span>
            <div className="bg-hairline relative h-2 flex-1 overflow-hidden rounded-full">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, background: '#F59E0B', transition: 'width 0.5s' }}
              />
            </div>
            <span className="text-faint w-5 text-right text-xs">{count}</span>
          </div>
        );
      })}
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
          style={{
            fontSize: 36,
            color: s <= active ? '#F59E0B' : 'var(--surface-2)',
            transition: 'color 0.15s, transform 0.1s',
            transform: s <= active ? 'scale(1.15)' : 'scale(1)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

// STAR_LABELS moved inside RateTeacherSheet to use t()

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
        onError: () => {
          toast.error(t('teacher.error_must_be_student'));
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="border-hairline w-full rounded-t-3xl border px-5 pb-8 pt-5"
        style={{ background: '#1a2538' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <span className="text-5xl">⭐</span>
            <p className="text-lg font-bold text-white">{t('teacher.rate_thanks')}</p>
            <p className="text-muted text-sm">{t('teacher.rate_thanks_sub')}</p>
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-center text-base font-bold text-white">
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
                      className={`press flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                        selectedClassId === c.id
                          ? 'bg-brand/25 border-brand/50 text-brand-400'
                          : 'bg-surface border-hairline text-white/70'
                      }`}
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
            {rating > 0 && (
              <p className="text-warn mb-4 text-center text-sm font-semibold">
                {(t('teacher.star_labels', { returnObjects: true }) as string[])[rating]}
              </p>
            )}
            {rating === 0 && <div className="mb-4" />}

            {/* Comment */}
            <textarea
              ref={textRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('teacher.comment_ph')}
              rows={3}
              className="bg-surface-2 border-hairline mb-4 w-full resize-none rounded-2xl border px-4 py-3 text-sm text-white outline-none"
            />

            <button
              onClick={handleSubmit}
              disabled={!canSubmit || rateTeacher.isPending}
              className="press w-full rounded-2xl py-3 text-sm font-bold text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#C8623F,#ECA985)' }}
            >
              {rateTeacher.isPending
                ? '...'
                : existing
                  ? `💾 ${t('teacher.rate_update')}`
                  : `⭐ ${t('teacher.rate_submit')}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ClassCard({
  cls,
  teacherId,
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
  teacherId: string;
}) {
  const { t } = useTranslation();
  const enroll = useEnrollClass();
  const joinWaitlist = useJoinWaitlist(cls.id);
  const { fmt } = useCurrency();
  const [done, setDone] = useState(false);

  const handleEnroll = () => {
    enroll.mutate(cls.id, {
      onSuccess: () => setDone(true),
    });
  };

  const handleWaitlist = () => {
    joinWaitlist.mutate(undefined, {
      onSuccess: () => setDone(true),
    });
  };

  const dayLabel = (d: string) => t(`schedule.day_${d.toLowerCase()}`, { defaultValue: d });

  return (
    <div className="bg-surface border-hairline rounded-2xl border p-4">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{cls.language.flag_emoji}</span>
            <span className="font-semibold text-white">{cls.title}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="bg-brand/20 text-brand-400 rounded-lg px-2 py-0.5 text-xs font-bold">
              {cls.level}
            </span>
            <span className="text-faint text-xs">{cls.language.name_ru}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-white">{fmt(cls.price_uzs)}</div>
          <div className="text-xs" style={{ color: cls.is_full ? '#EF4444' : '#10B981' }}>
            {cls.is_full ? t('teacher.no_spots') : `${cls.spots_left} / ${cls.max_students}`}
          </div>
        </div>
      </div>

      {/* Schedule */}
      {cls.schedule_days && cls.schedule_days.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {cls.schedule_days.map((d) => (
            <span key={d} className="bg-surface-2 rounded-lg px-2 py-0.5 text-xs text-white/60">
              {dayLabel(d)}
            </span>
          ))}
          {cls.schedule_time && (
            <span className="bg-surface-2 rounded-lg px-2 py-0.5 text-xs text-white/60">
              {cls.schedule_time}
            </span>
          )}
          {cls.schedule_duration && (
            <span className="bg-surface-2 rounded-lg px-2 py-0.5 text-xs text-white/60">
              {t('teacher.minutes', { n: cls.schedule_duration })}
            </span>
          )}
        </div>
      )}

      {cls.description && (
        <p className="text-muted mb-3 text-xs leading-relaxed">{cls.description}</p>
      )}

      {/* CTA */}
      {done ? (
        <div className="bg-ok/15 text-ok rounded-xl py-2.5 text-center text-sm font-semibold">
          {cls.is_full ? `✓ ${t('teacher.in_queue')}` : `✓ ${t('teacher.request_sent')}`}
        </div>
      ) : cls.is_full ? (
        <button
          onClick={handleWaitlist}
          disabled={joinWaitlist.isPending}
          className="bg-warn/15 text-warn press w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {joinWaitlist.isPending ? '...' : `⏳ ${t('teacher.join_queue')}`}
        </button>
      ) : (
        <button
          onClick={handleEnroll}
          disabled={enroll.isPending}
          className="press w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #C8623F, #ECA985)', color: '#fff' }}
        >
          {enroll.isPending ? '...' : t('teacher.enroll_btn')}
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function TeacherProfilePage() {
  const { t } = useTranslation();
  const { teacherId } = useParams<{ teacherId: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const { data: teacher, isLoading, isError } = useTeacherProfile(teacherId ?? '');
  const { data: myRatings } = useMyTeacherRating(role === 'STUDENT' ? (teacherId ?? '') : '');
  const [showRateSheet, setShowRateSheet] = useState(false);

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

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      {/* Hero */}
      <div
        className="relative px-4 pb-6 pt-6"
        style={{
          background: 'linear-gradient(180deg, rgba(200,98,63,0.18) 0%, rgba(22,32,46,0.0) 100%)',
        }}
      >
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {teacher.photo_url ? (
              <img
                src={teacher.photo_url}
                alt={fullName}
                className="h-20 w-20 rounded-2xl object-cover"
                style={{ border: '2px solid rgba(200,98,63,0.4)' }}
              />
            ) : (
              <div className="bg-brand/20 text-brand-400 flex h-20 w-20 items-center justify-center rounded-2xl text-3xl font-bold">
                {teacher.user.first_name[0]}
              </div>
            )}
          </div>

          {/* Name + level + rating */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-white">{fullName}</h1>

            {/* Level badge */}
            <div className="mt-1">
              <span
                className="rounded-xl px-3 py-1 text-xs font-bold"
                style={{
                  background: `${teacher.level.color}22`,
                  color: teacher.level.color,
                  border: `1px solid ${teacher.level.color}44`,
                }}
              >
                {teacher.level.label}
                {teacher.level.min_votes &&
                  ` · ${t('teacher.votes_needed', { n: teacher.level.min_votes })}`}
              </span>
            </div>

            {/* Rating */}
            {teacher.avg_rating !== null ? (
              <div className="mt-2 flex items-center gap-2">
                <StarBar value={teacher.avg_rating} />
                <span className="font-bold text-white">{teacher.avg_rating}</span>
                <span className="text-faint text-xs">({teacher.ratings_count})</span>
              </div>
            ) : (
              <p className="text-faint mt-1 text-xs">{t('teacher.no_ratings')}</p>
            )}
          </div>
        </div>

        {/* Bio */}
        {teacher.bio && <p className="mt-4 text-sm leading-relaxed text-white/70">{teacher.bio}</p>}

        {/* Social links */}
        {(teacher.website_url || teacher.instagram_url || teacher.telegram_url) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {teacher.website_url && (
              <a
                href={teacher.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface-2 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-white/70"
              >
                🌐 {t('teacher.website')}
              </a>
            )}
            {teacher.instagram_url && (
              <a
                href={teacher.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium"
                style={{ background: 'rgba(225,48,108,0.15)', color: '#E1306C' }}
              >
                📸 Instagram
              </a>
            )}
            {teacher.telegram_url && (
              <a
                href={teacher.telegram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium"
                style={{ background: 'rgba(0,136,204,0.15)', color: '#0088CC' }}
              >
                ✈️ Telegram
              </a>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4 px-4">
        {/* Badges */}
        {teacher.badges.length > 0 && (
          <div className="bg-surface border-surface-2 rounded-2xl border p-4">
            <h2 className="mb-3 text-sm font-bold text-white">🏅 {t('teacher.achievements')}</h2>
            <div className="flex flex-wrap gap-2">
              {teacher.badges.map((b) => (
                <div
                  key={b.id}
                  className="bg-surface-2 border-hairline flex items-center gap-2 rounded-xl border px-3 py-2"
                >
                  <span className="text-xl">{b.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-white">{b.title}</div>
                    {b.description && <div className="text-faint text-xs">{b.description}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rate button — only for students */}
        {role === 'STUDENT' && teacher.classes.length > 0 && (
          <button
            onClick={() => setShowRateSheet(true)}
            className={`press flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold ${
              myRatings && myRatings.length > 0
                ? 'bg-warn/15 border-warn/30 text-warn'
                : 'bg-brand/15 border-brand/30 text-brand-400'
            }`}
          >
            {myRatings && myRatings.length > 0 ? (
              <>
                <span>★ {t('teacher.your_rating_n', { rating: myRatings[0]?.rating })}</span>
                <span className="text-faint text-[11px]">· {t('teacher.change')}</span>
              </>
            ) : (
              <>⭐ {t('teacher.rate_teacher_btn')}</>
            )}
          </button>
        )}

        {/* Ratings breakdown */}
        {teacher.ratings_count > 0 && (
          <div className="bg-surface border-surface-2 rounded-2xl border p-4">
            <h2 className="mb-3 text-sm font-bold text-white">⭐ {t('teacher.rating_title')}</h2>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-4xl font-black text-white">{teacher.avg_rating}</div>
                <StarBar value={teacher.avg_rating ?? 0} />
                <div className="text-faint mt-1 text-xs">
                  {t('teacher.ratings_count_n', { n: teacher.ratings_count })}
                </div>
              </div>
              <div className="flex-1">
                <StarsHistogram breakdown={teacher.stars_breakdown} total={teacher.ratings_count} />
              </div>
            </div>

            {/* Recent reviews */}
            {teacher.recent_reviews && teacher.recent_reviews.length > 0 && (
              <div className="mt-3 space-y-2">
                {teacher.recent_reviews.map((r, i) => (
                  <div key={i} className="bg-surface rounded-xl p-3">
                    <div className="mb-1">
                      <StarBar value={r.rating} />
                    </div>
                    <p className="text-xs text-white/60">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Classes */}
        {teacher.classes.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-bold text-white">📚 {t('teacher.classes_title')}</h2>
            <div className="stagger space-y-3">
              {teacher.classes.map((cls) => (
                <ClassCard key={cls.id} cls={cls} teacherId={teacher.id} />
              ))}
            </div>
          </div>
        )}

        {teacher.classes.length === 0 && (
          <EmptyState emoji="📚" title={t('teacher.no_active_classes')} />
        )}
      </div>

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
