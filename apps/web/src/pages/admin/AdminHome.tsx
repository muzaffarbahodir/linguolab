/**
 * AdminHome — дашборд администратора в TWA.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { useBackButton } from '../../hooks/useBackButton';

import { useAuthStore, type Role } from '../../store/auth';
import { useAdminDashboard, useRecentPayments } from '../../api/admin';
import { useAllTransfers } from '../../api/enrollments';
import { useAllTrials } from '../../api/trial-lessons';
import { useAllTickets } from '../../api/support';
import { formatUzs } from '../../lib/money';

// ROLE_LABEL moved inside component to use t()

const ROLE_COLOR: Record<string, string> = {
  MANAGER: '#3B82F6',
  ADMIN: '#EF4444',
  SUPER_ADMIN: '#F59E0B',
};

type QuickGroup = 'people' | 'learning' | 'finance' | 'system';

interface QuickLink {
  emoji: string;
  label: string;
  path: string;
  color: string;
  group: QuickGroup;
  adminOnly?: boolean;
  superOnly?: boolean;
}

type TFn = (key: string) => string;

/** Срезает ведущий эмодзи из подписи (некоторые заголовки содержат его в переводе,
 *  а в меню эмодзи уже показан отдельным чипом → иначе дублируется). */
const LEADING_EMOJI = /^[\p{Extended_Pictographic}️‍\s]+/u;
function stripLeadingEmoji(s: string): string {
  return s.replace(LEADING_EMOJI, '');
}

/** Порядок секций меню админа. */
const GROUP_ORDER: { key: QuickGroup; tKey: string }[] = [
  { key: 'people', tKey: 'admin.home.grp_people' },
  { key: 'learning', tKey: 'admin.home.grp_learning' },
  { key: 'finance', tKey: 'admin.home.grp_finance' },
  { key: 'system', tKey: 'admin.home.grp_system' },
];

function getQuickLinks(t: TFn): QuickLink[] {
  return [
    // ── Люди ──
    {
      emoji: '👥',
      label: t('admin.users.title'),
      path: '/admin/users',
      color: '#6366f1',
      group: 'people',
    },
    {
      emoji: '🎓',
      label: t('admin.students.title'),
      path: '/admin/students',
      color: '#818cf8',
      group: 'people',
    },
    {
      emoji: '👨‍🏫',
      label: t('admin.teachers.title'),
      path: '/admin/teachers',
      color: '#3B82F6',
      group: 'people',
    },
    // ── Обучение ──
    {
      emoji: '📚',
      label: t('admin.classes.title'),
      path: '/admin/classes',
      color: '#10B981',
      group: 'learning',
    },
    {
      emoji: '📋',
      label: t('admin.enrollments.title'),
      path: '/admin/enrollments',
      color: '#F59E0B',
      group: 'learning',
    },
    {
      emoji: '🎯',
      label: t('admin.trials.title'),
      path: '/admin/trials',
      color: '#F59E0B',
      group: 'learning',
    },
    {
      emoji: '🔄',
      label: t('admin.transfers.title'),
      path: '/admin/transfers',
      color: '#818cf8',
      group: 'learning',
    },
    {
      emoji: '📜',
      label: t('admin.certificates.title'),
      path: '/admin/certificates',
      color: '#10B981',
      group: 'learning',
    },
    {
      emoji: '🌐',
      label: t('admin.languages.title'),
      path: '/admin/languages',
      color: '#06B6D4',
      group: 'learning',
      superOnly: true,
    },
    // ── Финансы ──
    {
      emoji: '🏦',
      label: t('admin.finance.title'),
      path: '/admin/finance',
      color: '#10B981',
      group: 'finance',
      adminOnly: true,
    },
    {
      emoji: '📊',
      label: t('admin.analytics.title'),
      path: '/admin/analytics',
      color: '#F59E0B',
      group: 'finance',
      adminOnly: true,
    },
    {
      emoji: '👔',
      label: t('admin.hr.title'),
      path: '/admin/hr',
      color: '#0EA5E9',
      group: 'finance',
      adminOnly: true,
    },
    {
      emoji: '⚙️',
      label: t('admin.payment_settings.title'),
      path: '/admin/payment-settings',
      color: '#6B7280',
      group: 'finance',
      adminOnly: true,
    },
    {
      emoji: '🔗',
      label: t('admin.referrals.title'),
      path: '/admin/referrals',
      color: '#818cf8',
      group: 'finance',
    },
    // ── Система ──
    {
      emoji: '🎫',
      label: t('admin.support.title'),
      path: '/admin/support',
      color: '#EF4444',
      group: 'system',
    },
    {
      emoji: '📢',
      label: t('admin.broadcast.title'),
      path: '/admin/broadcast',
      color: '#3B82F6',
      group: 'system',
      adminOnly: true,
    },
    {
      emoji: '📣',
      label: t('admin.announce.title'),
      path: '/admin/announcements',
      color: '#F5C518',
      group: 'system',
      superOnly: true,
    },
    {
      emoji: '🧾',
      label: t('admin.audit.title'),
      path: '/admin/audit',
      color: '#F59E0B',
      group: 'system',
      adminOnly: true,
    },
  ];
} // end getQuickLinks

const PREVIEW_ROLES_BASE: { role: Role; tKey: string; emoji: string; color: string }[] = [
  { role: 'STUDENT', tKey: 'profile.role_student', emoji: '🎓', color: '#6366f1' },
  { role: 'TEACHER', tKey: 'profile.role_teacher', emoji: '👨‍🏫', color: '#3B82F6' },
  { role: 'PARENT', tKey: 'profile.role_parent', emoji: '👨‍👧', color: '#10B981' },
  { role: 'MANAGER', tKey: 'profile.role_manager', emoji: '🛠', color: '#818cf8' },
];

export function AdminHomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setPreviewRole = useAuthStore((s) => s.setPreviewRole);
  const role = user?.role ?? 'ADMIN';

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isSuper = role === 'SUPER_ADMIN';

  const { data: widgets, isFetching } = useAdminDashboard();
  const { data: recentPayments } = useRecentPayments(8);
  const { data: pendingTransfers } = useAllTransfers('PENDING');
  const { data: pendingTrials } = useAllTrials('PENDING');
  const { data: openTickets } = useAllTickets('OPEN');
  const pendingTransferCount = pendingTransfers?.length ?? 0;
  const pendingTrialCount = pendingTrials?.length ?? 0;
  const openTicketCount = openTickets?.length ?? 0;

  useBackButton(() => navigate('/profile'));

  const handlePreview = (previewRole: Role) => {
    setPreviewRole(previewRole);
    // Navigate to the root of that role
    if (previewRole === 'TEACHER') navigate('/teacher');
    else navigate('/');
  };

  const ROLE_LABEL: Record<string, string> = {
    MANAGER: t('profile.role_manager'),
    ADMIN: t('profile.role_admin'),
    SUPER_ADMIN: t('profile.role_super_admin'),
  };
  const PREVIEW_ROLES = PREVIEW_ROLES_BASE.map((r) => ({ ...r, label: t(r.tKey) }));
  const roleColor = ROLE_COLOR[role] ?? '#6366f1';
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-5">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-2xl">🔐</span>
          <span
            className="rounded-full px-3 py-0.5 text-xs font-bold"
            style={{
              background: `${roleColor}22`,
              color: roleColor,
              border: `1px solid ${roleColor}44`,
            }}
          >
            {roleLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <h1 className="shimmer-brand-text text-xl font-bold">{t('admin.home.title')}</h1>
          {isFetching && (
            <div className="border-brand/30 border-t-brand h-4 w-4 animate-spin rounded-full border-2" />
          )}
        </div>
        <p className="text-tg-hint mt-0.5 text-sm">
          {user?.first_name} {user?.last_name}
        </p>
      </div>

      {/* Widgets (ADMIN+ only) — свайпаемая карусель карточек */}
      {isAdmin && (
        <div className="mb-5">
          {widgets ? (
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <WidgetCard
                emoji="🎓"
                label={t('admin.home.stat_students')}
                value={String(widgets.total_students)}
                color="#6366f1"
              />
              <WidgetCard
                emoji="📚"
                label={t('admin.home.stat_enrollments')}
                value={String(widgets.active_enrollments)}
                color="#818cf8"
              />
              <WidgetCard
                emoji="📅"
                label={t('admin.home.stat_lessons_week')}
                value={String(widgets.lessons_this_week)}
                color="#3B82F6"
              />
              <WidgetCard
                emoji="👨‍🏫"
                label={t('admin.home.stat_teachers')}
                value={String(widgets.total_teachers)}
                color="#10B981"
              />
              <WidgetCard
                emoji="✏️"
                label={t('admin.home.stat_pending_hw')}
                value={String(widgets.pending_homework)}
                color="#F59E0B"
              />
              <WidgetCard
                emoji="💰"
                label={t('admin.home.stat_revenue')}
                value={formatUzs(Math.round(widgets.revenue_this_month / 100))}
                color="#EF4444"
                wide
                onClick={() => navigate('/admin/finance')}
              />
            </div>
          ) : null}

          {/* Pending transfers alert */}
          {pendingTransferCount > 0 && (
            <button
              onClick={() => navigate('/admin/transfers')}
              className="bg-brand-400/10 border-brand-400/25 press mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left"
            >
              <span className="text-xl">🔄</span>
              <div className="flex-1">
                <p className="text-brand-400 text-xs font-semibold">
                  {t('admin.home.pending_transfers', { n: pendingTransferCount })}
                </p>
                <p className="text-tg-hint text-xs">{t('admin.home.review_hint')}</p>
              </div>
            </button>
          )}

          {/* Pending trials alert */}
          {pendingTrialCount > 0 && (
            <button
              onClick={() => navigate('/admin/trials')}
              className="bg-warn/10 border-warn/25 press mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left"
            >
              <span className="text-xl">🎯</span>
              <div className="flex-1">
                <p className="text-warn text-xs font-semibold">
                  {t('admin.home.pending_trials', { n: pendingTrialCount })}
                </p>
                <p className="text-tg-hint text-xs">{t('admin.home.review_hint')}</p>
              </div>
            </button>
          )}

          {/* Open support tickets alert */}
          {openTicketCount > 0 && (
            <button
              onClick={() => navigate('/admin/support')}
              className="bg-danger/10 border-danger/20 press mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left"
            >
              <span className="text-xl">🎫</span>
              <div className="flex-1">
                <p className="text-danger text-xs font-semibold">
                  {t('admin.home.open_tickets', { n: openTicketCount })}
                </p>
                <p className="text-tg-hint text-xs">{t('admin.home.reply_hint')}</p>
              </div>
            </button>
          )}

          {/* Pending users alert */}
          {widgets && widgets.pending_users > 0 && (
            <button
              onClick={() => navigate('/admin/users')}
              className="bg-warn/10 border-warn/25 press mt-3 flex w-full items-center gap-3 rounded-2xl border p-3 text-left"
            >
              <span className="text-xl">⏳</span>
              <div className="flex-1">
                <p className="text-warn text-xs font-semibold">
                  {t('admin.home.pending_users', { n: widgets.pending_users })}
                </p>
                <p className="text-tg-hint text-xs">{t('admin.home.review_hint')}</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Последние оплаты (ADMIN+) */}
      {isAdmin && recentPayments && recentPayments.length > 0 && (
        <div className="mb-5">
          <button
            onClick={() => navigate('/admin/finance')}
            className="text-tg-hint mb-2 flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wide"
          >
            {t('admin.home.recent_payments')}
            <ChevronRight size={14} />
          </button>
          <div className="glass-section overflow-hidden rounded-2xl">
            {recentPayments.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 px-3.5 py-2.5 ${
                  i < recentPayments.length - 1 ? 'border-hairline border-b' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.student}</p>
                  <p className="text-tg-hint truncate text-xs">
                    {p.class_title ?? '—'} · {p.provider}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-ok text-sm font-bold">{formatUzs(p.amount_uzs)}</p>
                  <p className="text-tg-hint text-[11px]">
                    {new Date(p.paid_at).toLocaleDateString(i18n.language)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links — компактные секции вместо больших карточек */}
      {GROUP_ORDER.map((grp) => {
        const links = getQuickLinks(t as TFn).filter(
          (l) => l.group === grp.key && (!l.adminOnly || isAdmin) && (!l.superOnly || isSuper),
        );
        if (!links.length) return null;
        return (
          <div key={grp.key} className="mb-4">
            <h2 className="text-tg-hint mb-2 text-xs font-semibold uppercase tracking-wide">
              {t(grp.tKey)}
            </h2>
            <div className="glass-section overflow-hidden rounded-2xl">
              {links.map((link, i) => (
                <button
                  key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`press flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${
                    i < links.length - 1 ? 'border-hairline border-b' : ''
                  }`}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-base"
                    style={{ background: `${link.color}1f` }}
                  >
                    {link.emoji}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">
                    {stripLeadingEmoji(link.label)}
                  </span>
                  <ChevronRight size={16} className="text-tg-hint shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Role preview — только ADMIN/SUPER_ADMIN (менеджеру не нужен) */}
      {isAdmin && (
        <div className="mt-6">
          <h2 className="text-tg-hint mb-2 text-xs font-semibold uppercase tracking-wide">
            {t('admin.home.preview_title')}
          </h2>
          <p className="text-tg-hint mb-3 text-xs">{t('admin.home.preview_desc')}</p>
          <div className="stagger grid grid-cols-2 gap-3">
            {PREVIEW_ROLES.map((p) => (
              <button
                key={p.role}
                onClick={() => handlePreview(p.role)}
                className="press flex items-center gap-3 rounded-2xl p-3 text-left"
                style={{ background: `${p.color}12`, border: `1px solid ${p.color}28` }}
              >
                <span className="text-xl">{p.emoji}</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: p.color }}>
                    {p.label}
                  </p>
                  <p className="text-tg-hint text-xs">{t('admin.home.open_hint')}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Widget card ───────────────────────────────────────────────────────────────

function WidgetCard({
  emoji,
  label,
  value,
  color,
  wide,
  onClick,
}: {
  emoji: string;
  label: string;
  value: string;
  color: string;
  /** Шире обычного — для длинных значений (выручка). */
  wide?: boolean;
  onClick?: () => void;
}) {
  // Длинные значения (выручка) уменьшаем, чтобы помещались.
  const valueSize = value.length > 8 ? 'text-base' : 'text-[1.7rem]';
  return (
    <div
      className={`shrink-0 snap-start overflow-hidden rounded-2xl ${wide ? 'min-w-[56%]' : 'min-w-[40%]'}`}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--hairline)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {/* Цветной акцент сверху */}
      <div className="h-1 w-full" style={{ background: color }} />
      <div className="p-3.5">
        <div
          className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-base"
          style={{ background: `${color}1f` }}
        >
          {emoji}
        </div>
        <div className={`font-extrabold leading-none ${valueSize}`} style={{ color }}>
          {value}
        </div>
        <div className="text-tg-hint mt-1.5 text-xs leading-tight">{label}</div>
      </div>
    </div>
  );
}
