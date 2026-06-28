import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  ClipboardCheck,
  Flame,
  Star,
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
  Inbox,
  ScanLine,
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
  MANAGER: { tKey: 'profile.role_manager', color: '#818cf8', bg: 'rgba(129,140,248,0.15)' },
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

  return (
    <div className="flex flex-col gap-4">
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
                onClick={() => go('/schedule')}
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
      Icon: Inbox,
      label: t('profile.requests_title'),
      hint: t('profile.requests_hint'),
      onClick: () => navigate('/requests'),
    },
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
      Icon: ScanLine,
      label: t('scan.title'),
      hint: t('scan.menu_hint'),
      onClick: () => navigate('/admin/scan'),
    },
    {
      Icon: Ticket,
      label: t('admin.promos.title'),
      hint: t('admin.promos.menu_hint'),
      onClick: () => navigate('/admin/promos'),
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
                  : 'rgba(129,140,248,0.12)',
            border: `1px solid ${
              role === 'SUPER_ADMIN'
                ? 'rgba(245,158,11,0.3)'
                : role === 'ADMIN'
                  ? 'rgba(239,68,68,0.3)'
                  : 'rgba(129,140,248,0.3)'
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
