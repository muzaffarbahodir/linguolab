import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  ClipboardCheck,
  Flame,
  Star,
  TrendingUp,
  Trophy,
  Home,
  Calendar,
  PencilLine,
  BookOpen,
  GraduationCap,
  BarChart3,
  Ticket,
  Users,
  Megaphone,
  ClipboardList,
  Shield,
  Gift,
  Coins,
  Palette,
  Plus,
  Inbox,
  ChevronDown,
  UserRound,
  Cake,
  type LucideIcon,
} from 'lucide-react';

import { useAuthStore, type Role } from '../store/auth';
import {
  useProgress,
  calcProgress,
  useStudentStats,
  useRecentLessons,
  useMe,
  usePatchMe,
} from '../api/users';
import { useTeacherStats } from '../api/teacher';
import { useUnreadCount } from '../api/notifications';
import { useMyReferral, useRedeemReferral } from '../api/referrals';
import { useMyTrials, useRequestTrial, type TrialType } from '../api/trial-lessons';
import { useMyClassRequests } from '../api/class-requests';
import { useLanguages } from '../api/languages';
import { TRIAL_STATUS } from '../lib/status';
import { toast } from '../store/toast';
import { useThemeStore } from '../store/theme';

// ─── menu items ───────────────────────────────────────────────────────────────

export interface MenuItem {
  Icon: LucideIcon;
  label: string;
  hint?: string;
  onClick: () => void;
  destructive?: boolean;
}

// ─── Admin role config ────────────────────────────────────────────────────────

const ADMIN_ROLES: Role[] = ['MANAGER', 'ADMIN', 'SUPER_ADMIN'];

const ROLE_BADGE_STYLE: Record<string, { tKey: string; color: string; bg: string }> = {
  STUDENT: {
    tKey: 'profile.role_student',
    // slate — читается и на тёмной, и на светлой теме (раньше белый текст исчезал на светлой)
    color: '#64748B',
    bg: 'rgba(100,116,139,0.16)',
  },
  PARENT: { tKey: 'profile.role_parent', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  TEACHER: { tKey: 'profile.role_teacher', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  MANAGER: { tKey: 'profile.role_manager', color: '#E0875A', bg: 'rgba(224,135,90,0.15)' },
  ADMIN: { tKey: 'profile.role_admin', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  SUPER_ADMIN: { tKey: 'profile.role_super_admin', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
};

// ─── sub-components ───────────────────────────────────────────────────────────

function Avatar({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-20 w-20 rounded-full object-cover ring-2 ring-white/20"
      />
    );
  }
  return (
    <div className="bg-brand flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white">
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ─── Student dashboard (статистика по изучаемому предмету) ──────────────────────

// Цвет показателя по значению 0..100 (красный → жёлтый → зелёный).
const NEUTRAL = '#8B95A5'; // нет данных — серый, не красный
function bandColor(v: number): string {
  return v >= 70 ? '#22C55E' : v >= 40 ? '#F59E0B' : '#EF4444';
}

// Цвет статуса посещения занятия.
const ATT_COLOR: Record<string, string> = {
  PRESENT: '#22C55E',
  LATE: '#F59E0B',
  ABSENT: '#EF4444',
  EXCUSED: '#3B82F6',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

// Крупная метрика в шапке предмета.
function HeaderStat({
  Icon,
  label,
  value,
  color,
  onClick,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="press flex flex-col items-center gap-1 rounded-xl py-1">
      <Icon size={16} color={color} strokeWidth={2.4} />
      <span className="text-base font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </span>
      <span className="text-faint text-center text-[9px] font-semibold uppercase leading-tight tracking-wide">
        {label}
      </span>
    </button>
  );
}

// Мини-карточка показателя: значение + бар 0..100 + ярлык уровня.
function SkillCard({
  Icon,
  title,
  display,
  value,
  levelLabel,
  nodata,
  onClick,
}: {
  Icon: LucideIcon;
  title: string;
  display: string;
  value: number;
  levelLabel: string;
  nodata?: boolean;
  onClick: () => void;
}) {
  const c = nodata ? NEUTRAL : bandColor(value);
  const barW = nodata ? 0 : value;
  return (
    <button
      onClick={onClick}
      className="press bg-surface-2/50 flex flex-col items-start rounded-xl p-3 text-left"
    >
      <div className="text-muted mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
        <Icon size={13} strokeWidth={2.2} />
        <span className="truncate">{title}</span>
      </div>
      <p className="text-xl font-bold tabular-nums leading-none" style={{ color: c }}>
        {display}
      </p>
      <div className="bg-surface mt-2 h-1.5 w-full overflow-hidden rounded-full">
        <div className="h-full rounded-full" style={{ width: `${barW}%`, background: c }} />
      </div>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: c }}>
        {levelLabel}
      </p>
    </button>
  );
}

// Чип-показатель (хороший/плохой).
function Chip({ text, good }: { text: string; good: boolean }) {
  const c = good ? '#22C55E' : '#EF4444';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium"
      style={{ background: `${c}1a`, color: c }}
    >
      {good ? '✓' : '✕'} {text}
    </span>
  );
}

function StudentStatsCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: progress, isLoading: lp, isError: pErr, refetch: rp } = useProgress();
  const { data: stats, isLoading: ls, isError: sErr, refetch: rs } = useStudentStats();
  const { data: recent } = useRecentLessons();
  const loading = lp || ls;

  const go = (path: string) => {
    try {
      WebApp.HapticFeedback?.selectionChanged();
    } catch {
      /* старый клиент без haptic */
    }
    navigate(path);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="skeleton h-28 rounded-2xl" />
        <div className="skeleton h-52 rounded-2xl" />
      </div>
    );
  }

  // Ошибка загрузки — не прячем тихо, даём повтор.
  if (pErr || sErr) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 rounded-2xl p-6 text-center">
        <span className="text-2xl">⚠️</span>
        <p className="text-muted text-sm">{t('app.server_error')}</p>
        <button
          onClick={() => {
            void rp();
            void rs();
          }}
          className="bg-brand press rounded-xl px-5 py-2 text-sm font-semibold text-white"
        >
          {t('app.retry')}
        </button>
      </div>
    );
  }

  const percent = progress ? calcProgress(progress) : 0;
  const attendPct =
    stats && stats.lessons_total > 0
      ? Math.round((stats.lessons_attended / stats.lessons_total) * 100)
      : 0;
  const hwTotal = progress?.homework.total ?? 0;
  const hwPct = hwTotal > 0 ? Math.round(((progress?.homework.graded ?? 0) / hwTotal) * 100) : 0;
  const streak = stats?.streak_days ?? 0;
  const streakPct = Math.min(Math.round((streak / 30) * 100), 100);
  const avg = stats?.avg_grade ?? null; // оценка из 100 (бэкенд: @Min(0)@Max(100))
  const gradePct = avg == null ? 0 : Math.max(0, Math.min(Math.round(avg), 100));

  const lvl = (v: number) =>
    v >= 70 ? t('profile.lvl_high') : v >= 40 ? t('profile.lvl_mid') : t('profile.lvl_low');

  // Нет данных ≠ «низкий»: показываем нейтрально (серый, «—»), а не красным.
  const attendNo = !(stats && stats.lessons_total > 0);
  const hwNo = hwTotal === 0;
  const gradeNo = avg == null;
  const streakNo = streak === 0;
  const formColor = percent > 0 ? bandColor(percent) : NEUTRAL;

  const subject = progress?.classes?.[0];
  const level = progress?.placement_test?.level_assigned ?? subject?.level ?? null;
  const accent = subject?.language.color ?? '#E0875A';

  const skills = [
    {
      Icon: CalendarCheck,
      title: t('profile.dash_m_attend'),
      display: attendNo ? '—' : `${attendPct}%`,
      value: attendPct,
      nodata: attendNo,
      onClick: () => go('/attendance'),
    },
    {
      Icon: ClipboardCheck,
      title: t('profile.dash_m_hw'),
      display: hwNo ? '—' : `${hwPct}%`,
      value: hwPct,
      nodata: hwNo,
      onClick: () => go('/homework'),
    },
    {
      Icon: Star,
      title: t('profile.dash_m_grade'),
      display: gradeNo ? '—' : `${avg}/100`,
      value: gradePct,
      nodata: gradeNo,
      onClick: () => go('/achievements'),
    },
    {
      Icon: Flame,
      title: t('profile.dash_m_streak'),
      display: streakNo ? '—' : `${streak}`,
      value: streakPct,
      nodata: streakNo,
      onClick: () => go('/schedule'),
    },
  ];

  const strong = skills.filter((s) => !s.nodata && s.value >= 70).length;

  const good: string[] = [];
  const bad: string[] = [];
  if (progress?.placement_test)
    good.push(`${t('profile.stat_level')} ${progress.placement_test.level_assigned}`);
  else bad.push(t('profile.placement_test'));
  if (attendPct >= 80) good.push(`${t('profile.dash_m_attend')} ${attendPct}%`);
  else if (stats && stats.lessons_total > 0 && attendPct < 60)
    bad.push(`${t('profile.dash_m_attend')} ${attendPct}%`);
  if (hwTotal > 0 && hwPct >= 80) good.push(`${t('profile.dash_m_hw')} ${hwPct}%`);
  else if (hwTotal > 0 && hwPct < 60) bad.push(`${t('profile.dash_m_hw')} ${hwPct}%`);
  if (streak >= 3) good.push(`${t('profile.dash_m_streak')} ${streak}`);
  else bad.push(`${t('profile.dash_m_streak')} ${streak}`);
  if ((progress?.achievements_count ?? 0) > 0)
    good.push(`${t('profile.achievements')}: ${progress?.achievements_count}`);

  return (
    <div className="flex flex-col gap-4">
      {/* Шапка предмета + ключевые метрики */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-faint text-[10px] font-semibold uppercase tracking-wide">
              {t('profile.dash_subject')}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl">{subject?.language.flag_emoji ?? '🎓'}</span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">
                  {subject?.language.name_ru ?? t('profile.dash_no_subject')}
                </p>
                {subject?.class_title && (
                  <p className="text-muted truncate text-xs">{subject.class_title}</p>
                )}
              </div>
            </div>
          </div>
          {level && (
            <span
              className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-bold"
              style={{ background: `${accent}22`, color: accent }}
            >
              {level}
            </span>
          )}
        </div>

        <div className="bg-hairline my-3 h-px" />

        <div className="grid grid-cols-4 gap-1">
          <HeaderStat
            Icon={TrendingUp}
            label={t('profile.progress')}
            value={`${percent}%`}
            color={formColor}
            onClick={() => go('/courses')}
          />
          <HeaderStat
            Icon={CalendarCheck}
            label={t('profile.dash_m_attend')}
            value={attendNo ? '—' : `${attendPct}%`}
            color={attendNo ? NEUTRAL : bandColor(attendPct)}
            onClick={() => go('/attendance')}
          />
          <HeaderStat
            Icon={Star}
            label={t('profile.dash_m_grade')}
            value={gradeNo ? '—' : String(avg)}
            color={gradeNo ? NEUTRAL : '#ECA985'}
            onClick={() => go('/achievements')}
          />
          <HeaderStat
            Icon={Flame}
            label={t('profile.dash_m_streak')}
            value={streakNo ? '—' : `${streak}`}
            color={streakNo ? NEUTRAL : '#F59E0B'}
            onClick={() => go('/schedule')}
          />
        </div>
      </div>

      {/* Учебная форма */}
      <div className="glass-card rounded-2xl p-4">
        <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wide">
          {t('profile.dash_form')}
        </p>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-extrabold tabular-nums"
              style={{ background: `${formColor}1f`, color: formColor }}
            >
              {percent}
            </div>
            <span className="text-faint mt-1 text-[10px]">/ 100</span>
          </div>
          <div className="flex-1">
            <div className="bg-surface-2 h-2.5 w-full overflow-hidden rounded-full">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${percent}%`, background: formColor }}
              />
            </div>
            <p className="text-muted mt-2 flex items-center gap-1.5 text-xs">
              <Trophy size={13} strokeWidth={2.2} />
              {t('profile.dash_strong', { done: strong })}
            </p>
            <p className="text-faint mt-1 text-[10px] leading-snug">
              {t('profile.dash_form_hint')}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {skills.map((s, i) => (
            <SkillCard key={i} {...s} levelLabel={s.nodata ? '—' : lvl(s.value)} />
          ))}
        </div>
      </div>

      {/* Показатели */}
      <div className="glass-card rounded-2xl p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold" style={{ color: '#22C55E' }}>
              {t('profile.dash_good')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {good.length ? (
                good.map((g, i) => <Chip key={i} text={g} good />)
              ) : (
                <span className="text-faint text-xs">—</span>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold" style={{ color: '#EF4444' }}>
              {t('profile.dash_bad')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {bad.length ? (
                bad.map((b, i) => <Chip key={i} text={b} good={false} />)
              ) : (
                <span className="text-faint text-xs">—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Последние занятия */}
      {recent && recent.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wide">
            {t('profile.dash_recent')}
          </p>
          <div className="flex flex-col gap-2">
            {recent.map((l, i) => {
              const c = ATT_COLOR[l.status] ?? '#8B95A5';
              return (
                <div
                  key={i}
                  className="bg-surface-2/50 flex items-center gap-3 rounded-xl px-3 py-2.5"
                >
                  <span className="text-lg">{l.language.flag_emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.title || l.class_title}</p>
                    <p className="text-faint text-xs">{fmtDate(l.scheduled_at)}</p>
                  </div>
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase"
                    style={{ background: `${c}1f`, color: c }}
                  >
                    {t(`profile.att_${l.status.toLowerCase()}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Мои классы */}
      {progress && progress.classes.length > 0 && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-muted mb-3 text-xs font-semibold uppercase tracking-wide">
            {t('profile.dash_classes')}
          </p>
          <div className="flex flex-col gap-2">
            {progress.classes.map((c, i) => (
              <button
                key={i}
                onClick={() => go('/courses')}
                className="press bg-surface-2/60 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
              >
                <span className="text-xl">{c.language.flag_emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{c.class_title}</p>
                  <p className="text-faint text-xs">{c.language.name_ru}</p>
                </div>
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold"
                  style={{ background: `${c.language.color}22`, color: c.language.color }}
                >
                  {c.level}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Мои заявки (статусы поданных заявок + подача новой) ────────────────────────

const REQ_STATUS: Record<string, { color: string; key: string }> = {
  PENDING: { color: '#F59E0B', key: 'profile.req_pending' },
  APPROVED: { color: '#22C55E', key: 'profile.req_approved' },
  REJECTED: { color: '#EF4444', key: 'profile.req_rejected' },
};

function MyRequestsCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: trials } = useMyTrials();
  const { data: classReqs } = useMyClassRequests();
  const { data: languages } = useLanguages();
  const requestTrial = useRequestTrial();
  const [open, setOpen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [trialType, setTrialType] = useState<TrialType>('ONLINE');

  const submitTrial = (language_id: string) => {
    if (requestTrial.isPending) return;
    requestTrial.mutate(
      { language_id, type: trialType },
      {
        onSuccess: (res) => {
          setPicking(false);
          // Очный пробный — ведём на оплату (после оплаты авто-подтвердится).
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
          // Онлайн пробный — авто-доступ, ссылка ушла в чат.
          if (res.status === 'CONFIRMED') {
            toast.success(t('profile.trial_online_sent'));
          } else {
            toast.success(t('profile.requests_sent'));
          }
        },
        onError: (e: unknown) => {
          const msg =
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? null;
          toast.error(msg ?? t('app.server_error'));
        },
      },
    );
  };

  const rows = [
    ...(trials ?? []).map((tr) => {
      const unpaidOffline = tr.type === 'OFFLINE' && tr.status === 'PENDING';
      const m = TRIAL_STATUS[tr.status] ?? TRIAL_STATUS.PENDING!;
      return {
        id: `t-${tr.id}`,
        flag: tr.language.flag_emoji,
        title: tr.language.name_ru,
        sub: tr.type === 'OFFLINE' ? t('profile.trial_offline') : t('profile.trial_online'),
        color: unpaidOffline ? '#F59E0B' : m.color,
        statusLabel: unpaidOffline ? t('profile.trial_awaiting_pay') : t(m.labelKey),
        date: tr.created_at,
        note: tr.note ?? null,
        extra: null as string | null,
        pay:
          unpaidOffline && tr.class_id
            ? { trialId: tr.id, classId: tr.class_id, lang: tr.language.name_ru }
            : null,
      };
    }),
    ...(classReqs ?? []).map((cr) => {
      const m = REQ_STATUS[cr.status] ?? REQ_STATUS.PENDING!;
      return {
        id: `c-${cr.id}`,
        flag: cr.language.flag_emoji,
        title: cr.title,
        sub: cr.level,
        color: m.color,
        statusLabel: t(m.key),
        date: cr.created_at,
        note: cr.note ?? null,
        extra: cr.admin_note ?? cr.approved_class?.title ?? null,
        pay: null as { trialId: string; classId: string; lang: string } | null,
      };
    }),
  ];

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-muted text-xs font-semibold uppercase tracking-wide">
          {t('profile.requests_title')}
        </p>
        <button
          onClick={() => setPicking(true)}
          className="press text-brand-400 flex items-center gap-1 text-xs font-semibold"
        >
          <Plus size={14} strokeWidth={2.6} /> {t('profile.requests_submit')}
        </button>
      </div>

      {rows.length === 0 ? (
        <button
          onClick={() => setPicking(true)}
          className="press flex w-full flex-col items-center gap-2 py-4 text-center"
        >
          <Inbox size={28} className="text-faint" strokeWidth={1.8} />
          <p className="text-faint text-xs">{t('profile.requests_empty')}</p>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div key={r.id} className="bg-surface-2/50 overflow-hidden rounded-xl">
              <button
                onClick={() => setOpen((o) => (o === r.id ? null : r.id))}
                className="press flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <span className="text-lg">{r.flag}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.title}</p>
                  <p className="text-faint text-xs">{r.sub}</p>
                </div>
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold"
                  style={{ background: `${r.color}1f`, color: r.color }}
                >
                  {r.statusLabel}
                </span>
                <ChevronDown
                  size={15}
                  className="text-faint"
                  style={{
                    transform: open === r.id ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s',
                  }}
                />
              </button>
              {open === r.id && (
                <div className="border-hairline space-y-1 border-t px-3 py-2.5 text-xs">
                  <p className="text-muted">
                    {t('profile.req_date')}:{' '}
                    <span style={{ color: 'var(--text)' }}>{fmtDate(r.date)}</span>
                  </p>
                  {r.note && (
                    <p className="text-muted">
                      {t('profile.req_note')}:{' '}
                      <span style={{ color: 'var(--text)' }}>{r.note}</span>
                    </p>
                  )}
                  {r.extra && <p style={{ color: 'var(--text)' }}>{r.extra}</p>}
                  {r.pay && (
                    <button
                      onClick={() =>
                        navigate('/payment', {
                          state: {
                            classId: r.pay!.classId,
                            classTitle: `${r.pay!.lang} — ${t('profile.trial_offline')}`,
                            trialId: r.pay!.trialId,
                          },
                        })
                      }
                      className="glass-btn press mt-1 w-full rounded-xl py-2 text-xs font-semibold"
                    >
                      {t('profile.trial_pay_now')}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Пикер языка для подачи заявки на пробный урок */}
      {picking && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 p-0"
          onClick={() => setPicking(false)}
        >
          <div
            className="glass-section w-full max-w-lg rounded-t-3xl p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-bold">{t('profile.requests_pick')}</p>

            {/* Тип пробного: онлайн (бесплатно) / очный (платно) */}
            <div className="bg-surface-2 mb-3 flex rounded-xl p-1">
              {(['ONLINE', 'OFFLINE'] as TrialType[]).map((tp) => (
                <button
                  key={tp}
                  onClick={() => setTrialType(tp)}
                  className={`press flex-1 rounded-lg py-2 text-xs font-semibold ${
                    trialType === tp ? 'bg-brand/25 text-brand-400' : 'text-faint'
                  }`}
                >
                  {tp === 'ONLINE'
                    ? t('profile.trial_online_free')
                    : t('profile.trial_offline_paid')}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {(languages ?? []).map((lang) => (
                <button
                  key={lang.id}
                  disabled={requestTrial.isPending}
                  onClick={() => submitTrial(lang.id)}
                  className="press bg-surface-2 flex items-center gap-3 rounded-xl px-4 py-3 text-left disabled:opacity-50"
                >
                  <span className="text-xl">{lang.flag_emoji}</span>
                  <span className="flex-1 text-sm font-semibold">{lang.name_ru}</span>
                  <Plus size={16} className="text-brand-400" strokeWidth={2.4} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherStatsCard() {
  const { t } = useTranslation();
  const { data: stats } = useTeacherStats();

  const items = [
    {
      Icon: GraduationCap,
      value: stats?.classes_count ?? 0,
      label: t('profile.stat_teacher_classes'),
    },
    { Icon: Calendar, value: stats?.total_lessons ?? 0, label: t('profile.stat_lessons') },
    { Icon: Users, value: stats?.total_students ?? 0, label: t('profile.stat_teacher_students') },
    {
      Icon: BarChart3,
      value: stats?.avg_attendance_pct != null ? `${stats.avg_attendance_pct}%` : '—',
      label: t('profile.stat_attend'),
    },
    {
      Icon: ClipboardCheck,
      value: stats?.homework_graded ?? 0,
      label: t('profile.stat_teacher_hw_graded'),
    },
  ];

  return (
    <div className="glass-card rounded-2xl p-4">
      <p className="text-tg-hint mb-3 text-xs font-semibold uppercase tracking-wide">
        {t('profile.teacher_stats_title')}
      </p>
      <div className="grid grid-cols-5 gap-1">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1">
            <item.Icon size={18} strokeWidth={2} className="text-muted" />
            <span className="text-info text-xs font-bold">{item.value}</span>
            <span className="text-tg-hint text-center text-xs leading-tight">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CurrencyRow() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const patch = usePatchMe();
  const current = me?.preferred_currency ?? 'UZS';

  function toggle(c: 'UZS' | 'USD') {
    if (c === current || patch.isPending) return;
    WebApp.HapticFeedback.selectionChanged();
    patch.mutate({ preferred_currency: c });
  }

  return (
    <div className="flex w-full items-center gap-3 px-4 py-3.5">
      <Coins size={20} strokeWidth={2} className="text-muted" />
      <span className="flex-1 text-sm font-medium">{t('profile.currency')}</span>
      <div className="bg-surface-2 flex overflow-hidden rounded-xl">
        {(['UZS', 'USD'] as const).map((c) => (
          <button
            key={c}
            onClick={() => toggle(c)}
            className={`press px-3 py-1 text-xs font-semibold transition-colors ${
              current === c ? 'bg-brand text-white' : 'text-faint'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

export function GenderRow() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const patch = usePatchMe();
  const current = me?.gender ?? null;

  const set = (g: 'MALE' | 'FEMALE') => {
    if (patch.isPending) return;
    WebApp.HapticFeedback.selectionChanged();
    patch.mutate({ gender: current === g ? null : g }); // повторный тап — сброс
  };

  return (
    <div className="flex w-full items-center gap-3 px-4 py-3.5">
      <UserRound size={20} strokeWidth={2} className="text-muted" />
      <span className="flex-1 text-sm font-medium">{t('profile.gender')}</span>
      <div className="bg-surface-2 flex overflow-hidden rounded-xl">
        {(['MALE', 'FEMALE'] as const).map((g) => (
          <button
            key={g}
            onClick={() => set(g)}
            className={`press px-3 py-1 text-xs font-semibold transition-colors ${
              current === g ? 'bg-brand text-white' : 'text-faint'
            }`}
          >
            {t(g === 'MALE' ? 'profile.gender_male' : 'profile.gender_female')}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BirthDateRow() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const patch = usePatchMe();
  const value = me?.birth_date ? me.birth_date.slice(0, 10) : '';
  const age = me?.birth_date
    ? Math.floor((Date.now() - new Date(me.birth_date).getTime()) / 31557600000)
    : null;

  return (
    <div className="flex w-full items-center gap-3 px-4 py-3.5">
      <Cake size={20} strokeWidth={2} className="text-muted" />
      <span className="flex-1 text-sm font-medium">{t('profile.birth_date')}</span>
      {age != null && (
        <span className="text-faint text-xs">
          {age} {t('profile.years')}
        </span>
      )}
      <input
        type="date"
        value={value}
        aria-label={t('profile.birth_date')}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => patch.mutate({ birth_date: e.target.value || null })}
        className="bg-surface-2 text-faint rounded-xl px-2 py-1 text-xs outline-none"
      />
    </div>
  );
}

export function ThemeRow() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="flex w-full items-center gap-3 px-4 py-3.5">
      <Palette size={20} strokeWidth={2} className="text-muted" />
      <span className="flex-1 text-sm font-medium">{t('profile.theme')}</span>
      <div className="bg-surface-2 flex overflow-hidden rounded-xl">
        {(
          [
            ['dark', '🌙'],
            ['light', '☀️'],
          ] as const
        ).map(([v, icon]) => (
          <button
            key={v}
            onClick={() => {
              if (theme !== v) {
                WebApp.HapticFeedback.selectionChanged();
                setTheme(v);
              }
            }}
            className={`press px-3 py-1 text-xs font-semibold transition-colors ${
              theme === v ? 'bg-brand text-white' : 'text-faint'
            }`}
          >
            {icon} {t(`profile.theme_${v}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MenuRow({ Icon, label, hint, onClick, destructive }: MenuItem) {
  return (
    <button
      onClick={onClick}
      className={`press flex w-full items-center gap-3 px-4 py-3.5 text-left ${
        destructive ? 'text-tg-destructive' : ''
      }`}
    >
      <Icon size={19} strokeWidth={2} className={destructive ? '' : 'text-muted'} />
      <span className="flex-1 text-sm font-medium">{label}</span>
      {hint && <span className="text-tg-hint text-xs">{hint}</span>}
      {!destructive && <span className="text-tg-hint text-xs">›</span>}
    </button>
  );
}

// ─── ReferralCard ─────────────────────────────────────────────────────────────

function ReferralCard() {
  const { t } = useTranslation();
  const { data: ref, isLoading } = useMyReferral();
  const redeem = useRedeemReferral();
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemDone, setRedeemDone] = useState('');
  const [redeemErr, setRedeemErr] = useState('');

  if (isLoading) return null;

  function copyCode() {
    if (!ref) return;
    WebApp.HapticFeedback.selectionChanged();
    void navigator.clipboard.writeText(ref.code).catch(() => {});
    toast.success(t('profile.referral_copied', { code: ref.code }));
  }

  function handleRedeem() {
    const code = redeemCode.trim().toUpperCase();
    if (code.length < 6) return;
    setRedeemErr('');
    redeem.mutate(code, {
      onSuccess: (r) => {
        setRedeemDone(r.message ?? t('profile.referral_copied', { code }));
        setRedeemCode('');
        setRedeemOpen(false);
      },
      onError: (e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('app.server_error');
        setRedeemErr(msg);
      },
    });
  }

  return (
    <div className="bg-brand/10 border-brand/20 rounded-2xl border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Gift size={20} strokeWidth={2} className="text-brand-400" />
        <div>
          <p className="text-sm font-bold">{t('profile.referral_title')}</p>
          <p className="text-muted text-xs">{t('profile.referral_subtitle')}</p>
        </div>
      </div>

      {/* Code */}
      <button
        onClick={copyCode}
        className="bg-brand/15 border-brand/30 press mb-3 flex w-full items-center justify-between rounded-xl border px-4 py-2.5"
      >
        <span className="text-brand-400 font-mono text-lg font-bold tracking-widest">
          {ref?.code ?? '------'}
        </span>
        <span className="text-muted text-xs">{t('profile.referral_copy')}</span>
      </button>

      {/* Stats */}
      <div className="mb-3 flex items-center gap-4">
        <div>
          <p className="text-brand-400 text-lg font-bold">{ref?.used_count ?? 0}</p>
          <p className="text-faint text-xs">{t('profile.referral_invitations')}</p>
        </div>
        {ref && ref.bonus_days_granted > 0 && (
          <div>
            <p className="text-ok text-lg font-bold">+{ref.bonus_days_granted}</p>
            <p className="text-faint text-xs">{t('profile.referral_bonus')}</p>
          </div>
        )}
      </div>

      {/* Redeem someone else's code */}
      {redeemDone ? (
        <p className="text-ok text-center text-xs font-semibold">✅ {redeemDone}</p>
      ) : redeemOpen ? (
        <div className="flex gap-2">
          <input
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
            placeholder={t('profile.referral_redeem_ph')}
            maxLength={8}
            className={`bg-surface-2 flex-1 rounded-xl border px-3 py-2 font-mono text-sm uppercase text-white outline-none ${
              redeemErr ? 'border-danger' : 'border-hairline'
            }`}
          />
          <button
            onClick={handleRedeem}
            disabled={redeemCode.trim().length < 6 || redeem.isPending}
            className="bg-brand press rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {redeem.isPending ? '...' : t('profile.referral_ok')}
          </button>
        </div>
      ) : (
        <button onClick={() => setRedeemOpen(true)} className="text-faint text-xs">
          {t('profile.referral_has_code')}
        </button>
      )}

      {redeemErr && <p className="text-danger mt-1 text-xs">{redeemErr}</p>}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export function ProfilePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const tgUser = WebApp.initDataUnsafe?.user;
  const unreadCount = useUnreadCount();

  // Prefer Telegram photo (fresh, no R2 yet) over stored avatar_url
  const photoUrl = tgUser?.photo_url ?? user?.avatar_url;
  const firstName = user?.first_name ?? tgUser?.first_name ?? t('home.student');
  const lastName = user?.last_name ?? tgUser?.last_name ?? '';
  const username = user?.username ?? tgUser?.username;
  const role = user?.role;

  const isAdmin = role != null && ADMIN_ROLES.includes(role);
  const isTeacher = role === 'TEACHER';
  const isParent = role === 'PARENT';
  const isFullAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const badgeStyle = role ? (ROLE_BADGE_STYLE[role] ?? ROLE_BADGE_STYLE['STUDENT']!) : null;
  const badge = badgeStyle ? { ...badgeStyle, label: t(badgeStyle.tKey) } : null;

  // ── Teacher menu ──────────────────────────────────────────────────────────
  const teacherQuickLinks: MenuItem[] = [
    {
      Icon: Home,
      label: t('profile.teacher_home'),
      hint: t('profile.teacher_cabinet_hint'),
      onClick: () => navigate('/teacher'),
    },
    {
      Icon: ClipboardList,
      label: t('profile.teacher_hw_review'),
      hint: t('profile.teacher_hw_review_hint'),
      onClick: () => navigate('/teacher/homework'),
    },
  ];

  // ── Student quick links ───────────────────────────────────────────────────
  const studentQuickLinks: MenuItem[] = [
    {
      Icon: Calendar,
      label: t('profile.schedule'),
      hint: t('profile.schedule_hint'),
      onClick: () => navigate('/schedule'),
    },
    {
      Icon: PencilLine,
      label: t('profile.homework'),
      hint: t('profile.homework_hint'),
      onClick: () => navigate('/homework'),
    },
    {
      Icon: BookOpen,
      label: t('profile.my_courses'),
      hint: t('profile.courses_hint'),
      onClick: () => navigate('/courses'),
    },
    {
      Icon: Trophy,
      label: t('profile.achievements'),
      hint: t('profile.achievements_hint'),
      onClick: () => navigate('/achievements'),
    },
    {
      Icon: GraduationCap,
      label: t('profile.certificates'),
      hint: t('profile.certificates_hint'),
      onClick: () => navigate('/certificates'),
    },
    {
      Icon: BarChart3,
      label: t('profile.attendance'),
      hint: t('profile.attendance_hint'),
      onClick: () => navigate('/attendance'),
    },
    {
      Icon: Ticket,
      label: t('profile.support'),
      hint: t('profile.support_hint'),
      onClick: () => navigate('/support'),
    },
  ];

  // Admin menu items — shown only for MANAGER / ADMIN / SUPER_ADMIN
  const adminMenuItems: MenuItem[] = [
    {
      Icon: Home,
      label: t('profile.admin_dashboard'),
      hint: badge?.label,
      onClick: () => navigate('/admin'),
    },
    {
      Icon: Users,
      label: t('profile.admin_users_lbl'),
      onClick: () => navigate('/admin/users'),
    },
    {
      Icon: GraduationCap,
      label: t('profile.admin_students_lbl'),
      onClick: () => navigate('/admin/students'),
    },
    ...(isFullAdmin
      ? [
          {
            Icon: Megaphone,
            label: t('profile.admin_broadcast_lbl'),
            onClick: () => navigate('/admin/broadcast'),
          } as MenuItem,
          {
            Icon: ClipboardList,
            label: t('profile.admin_audit_lbl'),
            onClick: () => navigate('/admin/audit'),
          } as MenuItem,
        ]
      : []),
  ];

  return (
    <div className="glass-fade-in flex flex-col gap-5 px-4 pb-8 pt-6">
      {/* User info */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/settings')}
          aria-label={t('profile.settings')}
          className="press shrink-0 rounded-full"
        >
          <Avatar src={photoUrl} name={firstName} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">
            {firstName} {lastName}
          </p>
          {username && <p className="text-tg-hint text-sm">@{username}</p>}
          {badge && (
            <span
              className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
          )}
        </div>
        {/* Notification bell */}
        <button
          onClick={() => navigate('/notifications')}
          aria-label={t('app.notifications', 'Notifications')}
          className={`press relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            unreadCount > 0 ? 'bg-brand/20' : 'bg-surface-2'
          }`}
        >
          <span className={`text-xl ${unreadCount > 0 ? 'bell-ring' : ''}`}>🔔</span>
          {unreadCount > 0 && (
            <span className="bell-badge-pulse bg-danger absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Admin panel banner (for admins) */}
      {isAdmin && (
        <button
          onClick={() => navigate('/admin')}
          className="press flex items-center gap-3 rounded-2xl p-4 text-left"
          style={{
            background:
              role === 'SUPER_ADMIN'
                ? 'rgba(245,158,11,0.12)'
                : role === 'ADMIN'
                  ? 'rgba(239,68,68,0.12)'
                  : 'rgba(224,135,90,0.12)',
            border: `1px solid ${
              role === 'SUPER_ADMIN'
                ? 'rgba(245,158,11,0.3)'
                : role === 'ADMIN'
                  ? 'rgba(239,68,68,0.3)'
                  : 'rgba(224,135,90,0.3)'
            }`,
          }}
        >
          <Shield size={26} strokeWidth={2} style={{ color: badge?.color }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: badge?.color }}>
              {t('profile.admin_panel')}
            </p>
            <p className="text-tg-hint text-xs">{t('profile.admin_manage')}</p>
          </div>
          <span className="text-tg-hint text-xs">›</span>
        </button>
      )}

      {/* Teacher stats */}
      {isTeacher && <TeacherStatsCard />}

      {/* Teacher quick links */}
      {isTeacher && (
        <>
          <p className="text-tg-hint px-1 text-xs font-semibold uppercase tracking-wide">
            {t('profile.teacher_cabinet')}
          </p>
          <div className="glass-section -mt-3 overflow-hidden rounded-2xl">
            {teacherQuickLinks.map((item, idx) => (
              <div key={item.label}>
                <MenuRow {...item} />
                {idx < teacherQuickLinks.length - 1 && <div className="bg-hairline mx-4 h-px" />}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Parent cabinet banner */}
      {isParent && (
        <button
          onClick={() => navigate('/parent')}
          className="bg-ok/10 border-ok/25 press flex items-center gap-3 rounded-2xl border p-4 text-left"
        >
          <Users size={26} strokeWidth={2} className="text-ok" />
          <div className="flex-1">
            <p className="text-ok text-sm font-semibold">{t('profile.parent_cabinet')}</p>
            <p className="text-tg-hint text-xs">{t('profile.parent_children')}</p>
          </div>
          <span className="text-tg-hint text-xs">›</span>
        </button>
      )}

      {/* Stats (students only) */}
      {!isAdmin && !isTeacher && !isParent && <StudentStatsCard />}

      {/* My requests (students only) */}
      {!isAdmin && !isTeacher && !isParent && <MyRequestsCard />}

      {/* Referral card (students only) */}
      {!isAdmin && !isTeacher && !isParent && <ReferralCard />}

      {/* Student quick links */}
      {!isAdmin && !isTeacher && !isParent && (
        <>
          <p className="text-tg-hint -mt-1 px-1 text-xs font-semibold uppercase tracking-wide">
            {t('profile.my_cabinet')}
          </p>
          <div className="glass-section -mt-3 overflow-hidden rounded-2xl">
            {studentQuickLinks.map((item, idx) => (
              <div key={item.label}>
                <MenuRow {...item} />
                {idx < studentQuickLinks.length - 1 && <div className="bg-hairline mx-4 h-px" />}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Admin section */}
      {isAdmin && (
        <>
          <p className="text-tg-hint px-1 text-xs font-semibold uppercase tracking-wide">
            {t('profile.admin_section')}
          </p>
          <div className="glass-section -mt-3 overflow-hidden rounded-2xl">
            {adminMenuItems.map((item, idx) => (
              <div key={item.label}>
                <MenuRow {...item} />
                {idx < adminMenuItems.length - 1 && <div className="bg-hairline mx-4 h-px" />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
