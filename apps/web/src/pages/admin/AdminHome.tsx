/**
 * AdminHome — дашборд администратора в TWA.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '../../hooks/useBackButton';

import { useAuthStore, type Role } from '../../store/auth';
import { useAdminDashboard } from '../../api/admin';
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

interface QuickLink {
  emoji: string;
  label: string;
  desc: string;
  path: string;
  color: string;
  adminOnly?: boolean;
  superOnly?: boolean;
}

type TFn = (key: string) => string;

function getQuickLinks(t: TFn): QuickLink[] {
  return [
    {
      emoji: '👥',
      label: t('admin.users.title'),
      desc: t('admin.users.desc'),
      path: '/admin/users',
      color: '#6366f1',
    },
    {
      emoji: '🎓',
      label: t('admin.students.title'),
      desc: t('admin.students.desc'),
      path: '/admin/students',
      color: '#818cf8',
    },
    {
      emoji: '💰',
      label: t('admin.finance.title'),
      desc: t('admin.finance.desc'),
      path: '/admin/finance',
      color: '#10B981',
      adminOnly: true,
    },
    {
      emoji: '📢',
      label: t('admin.broadcast.title'),
      desc: t('admin.broadcast.desc'),
      path: '/admin/broadcast',
      color: '#3B82F6',
      adminOnly: true,
    },
    {
      emoji: '📋',
      label: t('admin.audit.title'),
      desc: t('admin.audit.desc'),
      path: '/admin/audit',
      color: '#F59E0B',
      adminOnly: true,
    },
    {
      emoji: '👨‍🏫',
      label: t('admin.teachers.title'),
      desc: t('admin.teachers.desc'),
      path: '/admin/teachers',
      color: '#3B82F6',
    },
    {
      emoji: '📚',
      label: t('admin.classes.title'),
      desc: t('admin.classes.desc'),
      path: '/admin/classes',
      color: '#10B981',
    },
    {
      emoji: '📊',
      label: t('admin.analytics.title'),
      desc: t('admin.analytics.desc'),
      path: '/admin/analytics',
      color: '#F59E0B',
      adminOnly: true,
    },
    {
      emoji: '📋',
      label: t('admin.enrollments.title'),
      desc: t('admin.enrollments.desc'),
      path: '/admin/enrollments',
      color: '#F59E0B',
    },
    {
      emoji: '🎓',
      label: t('admin.certificates.title'),
      desc: t('admin.certificates.desc'),
      path: '/admin/certificates',
      color: '#10B981',
    },
    {
      emoji: '⚙️',
      label: t('admin.payment_settings.title'),
      desc: t('admin.payment_settings.desc'),
      path: '/admin/payment-settings',
      color: '#6B7280',
      adminOnly: true,
    },
    {
      emoji: '🔗',
      label: t('admin.referrals.title'),
      desc: t('admin.referrals.desc'),
      path: '/admin/referrals',
      color: '#818cf8',
    },
    {
      emoji: '🔄',
      label: t('admin.transfers.title'),
      desc: t('admin.transfers.desc'),
      path: '/admin/transfers',
      color: '#818cf8',
    },
    {
      emoji: '🎯',
      label: t('admin.trials.title'),
      desc: t('admin.trials.desc'),
      path: '/admin/trials',
      color: '#F59E0B',
    },
    {
      emoji: '🎫',
      label: t('admin.support.title'),
      desc: t('admin.support.desc'),
      path: '/admin/support',
      color: '#EF4444',
    },
    {
      emoji: '🌐',
      label: t('admin.languages.title'),
      desc: t('admin.languages.desc'),
      path: '/admin/languages',
      color: '#06B6D4',
      superOnly: true,
    },
    {
      emoji: '📣',
      label: t('admin.announce.title'),
      desc: t('admin.announce.desc'),
      path: '/admin/announcements',
      color: '#F5C518',
      superOnly: true,
    },
    {
      emoji: '👔',
      label: t('admin.hr.title'),
      desc: t('admin.hr.desc'),
      path: '/admin/hr',
      color: '#0EA5E9',
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setPreviewRole = useAuthStore((s) => s.setPreviewRole);
  const role = user?.role ?? 'ADMIN';

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
  const isSuper = role === 'SUPER_ADMIN';

  const { data: widgets, isFetching } = useAdminDashboard();
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

      {/* Widgets (ADMIN+ only) */}
      {isAdmin && (
        <div className="mb-5">
          {widgets ? (
            <div className="grid grid-cols-2 gap-3">
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
                small
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

      {/* Quick links */}
      <h2 className="text-tg-hint mb-3 text-xs font-semibold uppercase tracking-wide">
        {t('admin.home.sections')}
      </h2>
      <div className="stagger grid grid-cols-2 gap-3">
        {getQuickLinks(t as TFn)
          .filter((l) => (!l.adminOnly || isAdmin) && (!l.superOnly || isSuper))
          .map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="glass-card press rounded-2xl p-4 text-left"
            >
              <div
                className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-xl"
                style={{ background: `${link.color}20` }}
              >
                {link.emoji}
              </div>
              <p className="text-sm font-semibold">{link.label}</p>
              <p className="text-tg-hint mt-0.5 text-xs">{link.desc}</p>
            </button>
          ))}
      </div>

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
  small,
  onClick,
}: {
  emoji: string;
  label: string;
  value: string;
  color: string;
  small?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{
        background: `${color}12`,
        border: `1px solid ${color}28`,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <div className="mb-1 text-xl">{emoji}</div>
      <div className={`font-bold ${small ? 'text-sm' : 'text-lg'}`} style={{ color }}>
        {value}
      </div>
      <div className="text-tg-hint mt-0.5 text-xs">{label}</div>
    </div>
  );
}
