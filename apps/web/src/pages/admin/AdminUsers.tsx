/**
 * AdminUsers — управление пользователями в TWA.
 * Список всех юзеров + pending activation + смена роли.
 * ADMIN / SUPER_ADMIN.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useBackButton } from '../../hooks/useBackButton';
import { useAuthStore } from '../../store/auth';
import {
  useAdminUsers,
  usePendingUsers,
  useAdminUser,
  useActivateUser,
  useChangeUserRole,
  type Role,
  type AdminUser,
  type AdminUserDetail,
} from '../../api/admin';

const ROLES: Role[] = ['STUDENT', 'PARENT', 'TEACHER', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'];

const ROLE_TKEY: Record<string, string> = {
  STUDENT: 'profile.role_student',
  PARENT: 'profile.role_parent',
  TEACHER: 'profile.role_teacher',
  MANAGER: 'profile.role_manager',
  ADMIN: 'profile.role_admin',
  SUPER_ADMIN: 'profile.role_super_admin',
};

const ROLE_COLOR: Record<string, string> = {
  STUDENT: 'var(--surface-2)',
  PARENT: '#10B981',
  TEACHER: '#3B82F6',
  MANAGER: '#818cf8',
  ADMIN: '#EF4444',
  SUPER_ADMIN: '#F59E0B',
};

type Tab = 'all' | 'pending';

export function AdminUsersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('pending');
  const [roleFilter, setRoleFilter] = useState<Role | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState<Role>('STUDENT');
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: allUsers, isLoading: allLoading } = useAdminUsers(page, roleFilter);
  const { data: pending, isLoading: pendingLoading } = usePendingUsers();
  const activateMutation = useActivateUser();
  const changeRoleMutation = useChangeUserRole();

  // Менеджер видит и активирует пользователей, но смена роли — только ADMIN+.
  const myRole = useAuthStore((s) => s.user?.role);
  const canManageRoles = myRole === 'ADMIN' || myRole === 'SUPER_ADMIN';
  const roleChips = canManageRoles
    ? ROLES
    : ROLES.filter((r) => r !== 'ADMIN' && r !== 'SUPER_ADMIN');

  useBackButton(() => {
    if (selectedUser) {
      setSelectedUser(null);
    } else if (detailId) {
      setDetailId(null);
    } else {
      navigate('/admin');
    }
  });

  const handleActivate = (user: AdminUser) => {
    WebApp.showConfirm(
      t('admin.users.activate_confirm', {
        name: `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`,
      }),
      (ok) => {
        if (!ok) return;
        activateMutation.mutate(
          { id: user.id },
          { onSuccess: () => WebApp.showAlert(t('admin.users.activated')) },
        );
      },
    );
  };

  const handleChangeRole = () => {
    if (!selectedUser) return;
    changeRoleMutation.mutate(
      { id: selectedUser.id, role: newRole },
      {
        onSuccess: () => {
          WebApp.showAlert(`✅ ${t(ROLE_TKEY[newRole] ?? 'profile.role_student')}`);
          setSelectedUser(null);
        },
        onError: (e) => {
          WebApp.showAlert(t('admin.users.error', { msg: e instanceof Error ? e.message : '?' }));
        },
      },
    );
  };

  const isLoading = tab === 'pending' ? pendingLoading : allLoading;
  const users = tab === 'pending' ? (pending ?? []) : (allUsers?.items ?? []);
  const total = tab === 'pending' ? (pending?.length ?? 0) : (allUsers?.total ?? 0);
  const pages = tab === 'all' ? Math.ceil((allUsers?.total ?? 0) / 20) : 1;

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold">👥 {t('admin.users.title')}</h1>
        <p className="text-tg-hint text-sm">{t('admin.teachers.total', { n: total })}</p>
      </div>

      {/* Tabs */}
      <div className="bg-surface border-hairline mb-4 flex rounded-2xl border p-1">
        {(['pending', 'all'] as Tab[]).map((tabId) => (
          <button
            key={tabId}
            onClick={() => {
              setTab(tabId);
              setPage(1);
            }}
            className={`press flex-1 rounded-xl py-2 text-sm font-medium transition-colors ${
              tab === tabId ? 'bg-brand/25 text-brand' : 'text-faint bg-transparent'
            }`}
          >
            {tabId === 'pending'
              ? `${t('admin.users.tab_pending')}${pending?.length ? ` (${pending.length})` : ''}`
              : t('admin.users.tab_all')}
          </button>
        ))}
      </div>

      {/* Role filter (all tab only) */}
      {tab === 'all' && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setRoleFilter(undefined)}
            className={`press whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${
              !roleFilter
                ? 'bg-brand/25 border-brand text-brand'
                : 'bg-surface border-hairline text-muted'
            }`}
          >
            {t('courses.all')}
          </button>
          {roleChips.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className="press whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: roleFilter === r ? `${ROLE_COLOR[r]}22` : 'var(--surface-2)',
                color: roleFilter === r ? ROLE_COLOR[r] : 'var(--surface-2)',
                border: `1px solid ${roleFilter === r ? `${ROLE_COLOR[r]}44` : 'var(--surface-2)'}`,
              }}
            >
              {t(ROLE_TKEY[r] ?? 'profile.role_student')}
            </button>
          ))}
        </div>
      )}

      {/* Pending hint */}
      {tab === 'pending' && (
        <div className="bg-warn/10 border-warn/20 text-warn mb-4 rounded-2xl border p-3 text-xs">
          {t('admin.users.pending_hint')}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
        </div>
      ) : users.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-2 text-4xl">{tab === 'pending' ? '✅' : '👤'}</p>
          <p className="text-tg-hint text-sm">
            {tab === 'pending' ? t('admin.users.empty_pending') : t('admin.users.empty_all')}
          </p>
        </div>
      ) : (
        <div className="stagger flex flex-col gap-2">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              canManageRoles={canManageRoles}
              onOpen={() => setDetailId(u.id)}
              onActivate={() => handleActivate(u)}
              onChangeRole={() => {
                setSelectedUser(u);
                setNewRole(u.role);
              }}
              activating={activateMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination (all tab) */}
      {tab === 'all' && pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="glass-option press rounded-xl px-4 py-2 text-sm disabled:opacity-40"
          >
            ←
          </button>
          <span className="text-tg-hint text-sm">
            {page} / {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="glass-option press rounded-xl px-4 py-2 text-sm disabled:opacity-40"
          >
            →
          </button>
        </div>
      )}

      {/* Change role bottom sheet */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedUser(null);
          }}
        >
          <div
            className="glass-card rounded-t-3xl p-6"
            style={{
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              background: 'var(--secondary-bg)',
            }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="mb-1 text-base font-bold">{t('admin.users.change_role_title')}</h3>
            <p className="text-tg-hint mb-4 text-sm">
              {selectedUser.first_name} {selectedUser.last_name ?? ''}
              {selectedUser.telegram_username && <span> · @{selectedUser.telegram_username}</span>}
            </p>

            <div className="mb-5 flex flex-col gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => setNewRole(r)}
                  className="press flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
                  style={{
                    background: newRole === r ? `${ROLE_COLOR[r]}20` : 'var(--surface-2)',
                    border: `2px solid ${newRole === r ? ROLE_COLOR[r] : 'var(--surface-2)'}`,
                  }}
                >
                  <span className="flex-1 text-sm font-medium">
                    {t(ROLE_TKEY[r] ?? 'profile.role_student')}
                  </span>
                  {newRole === r && (
                    <span className="text-sm font-bold" style={{ color: ROLE_COLOR[r] }}>
                      ✓
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={handleChangeRole}
              disabled={changeRoleMutation.isPending || newRole === selectedUser.role}
              className="glass-btn press w-full rounded-2xl py-3 font-semibold disabled:opacity-60"
            >
              {changeRoleMutation.isPending ? t('admin.users.saving') : t('admin.users.apply_role')}
            </button>
          </div>
        </div>
      )}

      {/* User detail bottom sheet */}
      {detailId && (
        <UserDetailSheet
          id={detailId}
          canManageRoles={canManageRoles}
          onClose={() => setDetailId(null)}
          onChangeRole={(u) => {
            setSelectedUser(u);
            setNewRole(u.role);
            setDetailId(null);
          }}
        />
      )}
    </div>
  );
}

// ── User detail sheet ───────────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <span className="text-tg-hint shrink-0 text-xs">{label}</span>
      <span className="text-right text-sm font-medium">{value || '—'}</span>
    </div>
  );
}

function UserDetailSheet({
  id,
  canManageRoles,
  onClose,
  onChangeRole,
}: {
  id: string;
  canManageRoles: boolean;
  onClose: () => void;
  onChangeRole: (u: AdminUserDetail) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: u, isLoading } = useAdminUser(id);

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language) : null;
  const genderLabel = (g: 'MALE' | 'FEMALE' | null) =>
    g === 'MALE' ? t('profile.gender_male') : g === 'FEMALE' ? t('profile.gender_female') : null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="glass-card max-h-[85vh] overflow-y-auto rounded-t-3xl p-6"
        style={{
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          background: 'var(--secondary-bg)',
        }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />

        {isLoading || !u ? (
          <div className="flex justify-center py-10">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3">
              <div className="bg-brand/20 text-brand flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold">
                {(u.first_name[0] ?? '?').toUpperCase()}
                {u.last_name?.[0]?.toUpperCase() ?? ''}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold">
                  {u.first_name} {u.last_name ?? ''}
                </h3>
                <p className="text-tg-hint text-sm">
                  {t(ROLE_TKEY[u.role] ?? 'profile.role_student')}
                  {' · '}
                  {u.is_active ? t('admin.users.active') : t('admin.users.inactive')}
                </p>
              </div>
            </div>

            <div className="bg-surface divide-hairline mb-5 divide-y rounded-2xl px-4">
              <DetailRow
                label={t('admin.users.d_username')}
                value={u.telegram_username && `@${u.telegram_username}`}
              />
              <DetailRow label={t('admin.users.d_tg_id')} value={u.telegram_user_id} />
              <DetailRow label={t('admin.users.d_phone')} value={u.phone} />
              <DetailRow label={t('admin.users.d_email')} value={u.email} />
              <DetailRow label={t('profile.gender')} value={genderLabel(u.gender)} />
              <DetailRow label={t('profile.birth_date')} value={fmtDate(u.birth_date)} />
              <DetailRow label={t('admin.users.d_locale')} value={u.locale?.toUpperCase()} />
              <DetailRow label={t('admin.users.d_currency')} value={u.preferred_currency} />
              <DetailRow
                label={t('admin.users.d_enrollments')}
                value={String(u.enrollments_count)}
              />
              <DetailRow label={t('admin.users.d_registered')} value={fmtDate(u.created_at)} />
              <DetailRow label={t('admin.users.d_last_active')} value={fmtDate(u.last_active_at)} />
            </div>

            {canManageRoles && (
              <button
                onClick={() => onChangeRole(u)}
                className="bg-brand/15 text-brand border-brand/30 press w-full rounded-2xl border py-3 text-sm font-semibold"
              >
                {t('admin.users.role_btn')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── User card ─────────────────────────────────────────────────────────────────

function UserCard({
  user,
  canManageRoles,
  onOpen,
  onActivate,
  onChangeRole,
  activating,
}: {
  user: AdminUser;
  canManageRoles: boolean;
  onOpen: () => void;
  onActivate: () => void;
  onChangeRole: () => void;
  activating: boolean;
}) {
  const { t, i18n } = useTranslation();
  const initials =
    (user.first_name[0] ?? '?').toUpperCase() + (user.last_name?.[0]?.toUpperCase() ?? '');

  const roleColor = ROLE_COLOR[user.role] ?? 'var(--surface-2)';

  return (
    <div className="glass-card rounded-2xl p-4">
      <button onClick={onOpen} className="press flex w-full items-start gap-3 text-left">
        {/* Avatar */}
        <div className="bg-brand/20 text-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
          {initials}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {user.first_name} {user.last_name ?? ''}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: `${roleColor}20`, color: roleColor }}
            >
              {t(ROLE_TKEY[user.role] ?? 'profile.role_student')}
            </span>
          </div>
          {user.telegram_username && (
            <p className="text-tg-hint text-xs">@{user.telegram_username}</p>
          )}
          <p className="text-tg-hint text-xs">
            ID: {user.telegram_user_id} ·{' '}
            {new Date(user.created_at).toLocaleDateString(i18n.language)}
          </p>
        </div>

        {/* Status dot */}
        <div
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ background: user.is_active ? '#10B981' : '#EF4444' }}
        />
      </button>

      {/* Actions */}
      {(!user.is_active || canManageRoles) && (
        <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
          {!user.is_active && (
            <button
              onClick={onActivate}
              disabled={activating}
              className="bg-ok/20 text-ok border-ok/30 press flex-1 rounded-xl border py-2 text-xs font-semibold disabled:opacity-60"
            >
              ✓ {t('admin.users.activate')}
            </button>
          )}
          {canManageRoles && (
            <button
              onClick={onChangeRole}
              className="bg-brand/15 text-brand border-brand/30 press flex-1 rounded-xl border py-2 text-xs font-semibold"
            >
              {t('admin.users.role_btn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
