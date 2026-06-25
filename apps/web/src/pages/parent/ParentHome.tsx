import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useMyChildren, useCreateInvite, type ChildListItem } from '../../api/parents';
import { useAuthStore } from '../../store/auth';
import { useUnreadCount } from '../../api/notifications';
import { toast } from '../../store/toast';
import { EmptyState } from '../../components/EmptyState';

// ─── InviteModal ──────────────────────────────────────────────────────────────

function InviteModal({
  code,
  expiresAt,
  onClose,
}: {
  code: string;
  expiresAt: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);

  const expiresStr = new Date(expiresAt).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCopy = () => {
    const ok = (() => {
      try {
        const el = document.createElement('textarea');
        el.value = code;
        el.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
        document.body.appendChild(el);
        el.focus();
        el.select();
        const result = document.execCommand('copy');
        document.body.removeChild(el);
        return result;
      } catch {
        return false;
      }
    })();
    if (ok) {
      WebApp.HapticFeedback.notificationOccurred('success');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      navigator.clipboard?.writeText(code).then(() => {
        WebApp.HapticFeedback.notificationOccurred('success');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="border-hairline w-full max-w-md rounded-t-3xl border px-6 pb-10 pt-6"
        style={{ background: 'rgba(22,32,46,0.98)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-6 h-1 w-10 rounded-full bg-white/20" />

        <p className="text-muted mb-2 text-center text-xs font-semibold uppercase tracking-widest">
          {t('parent.invite_code_label')}
        </p>

        {/* Code */}
        <button
          onClick={handleCopy}
          className={`mb-2 w-full rounded-2xl border-2 px-4 py-4 text-center transition-all active:scale-95 ${
            copied ? 'bg-ok/15 border-ok/40' : 'bg-brand/15 border-brand/40'
          }`}
        >
          <span
            className={`break-all font-mono text-lg font-bold leading-snug ${
              copied ? 'text-ok' : 'text-brand-400'
            }`}
          >
            {code}
          </span>
        </button>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="mb-4 w-full rounded-2xl py-3.5 font-bold text-white transition-all active:scale-95"
          style={{
            background: copied
              ? 'linear-gradient(135deg,#10B981,#059669)'
              : 'linear-gradient(135deg,#6C5CE7,#8B5CF6)',
          }}
        >
          {copied ? t('parent.invite_copied') : t('parent.invite_copy')}
        </button>

        <p className="text-faint text-center text-xs">
          {t('parent.invite_expires', { time: expiresStr })}
        </p>
      </div>
    </div>
  );
}

// ─── ChildCard ────────────────────────────────────────────────────────────────

function ChildCard({ item }: { item: ChildListItem }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { child } = item;
  const flags = child.active_classes.map((c) => c.language.flag_emoji).join(' ');

  return (
    <button
      onClick={() => {
        WebApp.HapticFeedback.selectionChanged();
        navigate(`/parent/child/${child.id}`);
      }}
      className="bg-surface border-hairline press flex w-full items-center gap-4 rounded-2xl border p-4 text-left"
    >
      {/* Avatar */}
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
        style={{ background: 'linear-gradient(135deg,#6C5CE7,#8B5CF6)' }}
      >
        {child.avatar_url ? (
          <img src={child.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          (child.first_name[0] ?? '?').toUpperCase()
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">
          {child.first_name} {child.last_name ?? ''}
        </p>
        {child.active_classes.length > 0 ? (
          <p className="mt-0.5 text-sm text-white/55">
            {flags}{' '}
            {child.active_classes.map((c) => (c.language.flag_emoji ? '' : c.title)).join(', ')}
            {child.active_classes.length}{' '}
            {child.active_classes.length === 1
              ? t('parent.active_class_1')
              : t('parent.active_class_few')}
          </p>
        ) : (
          <p className="text-faint mt-0.5 text-xs">{t('parent.no_active_classes')}</p>
        )}
        <p className="text-faint mt-1 text-xs">
          {t('parent.linked_at', {
            date: new Date(item.linked_at).toLocaleDateString(i18n.language, {
              day: 'numeric',
              month: 'long',
            }),
          })}
        </p>
      </div>

      <span className="text-faint text-xl">›</span>
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ParentHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useUnreadCount();
  const { data: children, isLoading } = useMyChildren();
  const createInvite = useCreateInvite();
  const [invite, setInvite] = useState<{ code: string; expires_at: string } | null>(null);

  const handleAddChild = async () => {
    try {
      const result = await createInvite.mutateAsync();
      WebApp.HapticFeedback.notificationOccurred('success');
      setInvite(result);
    } catch {
      toast.error(t('parent.invite_error'));
    }
  };

  return (
    <div className="glass-fade-in min-h-screen pb-24">
      {invite && (
        <InviteModal
          code={invite.code}
          expiresAt={invite.expires_at}
          onClose={() => setInvite(null)}
        />
      )}
      {/* Header */}
      <div
        className="px-4 pb-4 pt-12"
        style={{ background: 'rgba(22,32,46,0.95)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted text-xs font-medium uppercase tracking-widest">
              {t('parent.title')}
            </p>
            <h1 className="mt-1 text-xl font-bold">
              {user?.first_name ?? t('parent.fallback_name')}
            </h1>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            className={`press relative flex h-10 w-10 items-center justify-center rounded-full ${
              unreadCount > 0 ? 'bg-brand/20' : 'bg-surface-2'
            }`}
          >
            <span className={unreadCount > 0 ? 'bell-ring text-xl' : 'text-xl'}>🔔</span>
            {unreadCount > 0 && (
              <span className="bell-badge-pulse bg-danger absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Section header */}
        {(children?.length ?? 0) > 0 && (
          <div className="mb-3 flex items-center justify-between">
            <p className="text-muted text-xs font-semibold uppercase tracking-wide">
              {t('parent.my_children')}
            </p>
            <button
              onClick={handleAddChild}
              disabled={createInvite.isPending}
              className="bg-brand/20 text-brand-400 press flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
              {createInvite.isPending ? '...' : t('parent.link_short')}
            </button>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-8 w-8 animate-spin rounded-full border-4" />
          </div>
        )}

        {/* Empty */}
        {!isLoading && children?.length === 0 && (
          <EmptyState
            emoji="👨‍👩‍👧"
            title={t('parent.no_children')}
            subtitle={t('parent.no_children_sub')}
            action={{ label: t('parent.add_child'), onClick: handleAddChild }}
          />
        )}

        {/* Children list */}
        <div className="stagger flex flex-col gap-3">
          {children?.map((item) => (
            <ChildCard key={item.link_id} item={item} />
          ))}
        </div>

        {/* Info block */}
        {(children?.length ?? 0) > 0 && (
          <div className="bg-brand/10 border-brand/20 mt-6 rounded-2xl border px-4 py-3">
            <p className="text-muted text-xs leading-relaxed">{t('parent.child_tip')}</p>
          </div>
        )}

        {/* Profile / settings link */}
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => navigate('/profile')}
            className="bg-surface border-hairline press flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left"
          >
            <span className="text-xl">👤</span>
            <span className="flex-1 text-sm font-medium">{t('parent.my_profile')}</span>
            <span className="text-faint">›</span>
          </button>
          <button
            onClick={() => navigate('/language')}
            className="bg-surface border-hairline press flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left"
          >
            <span className="text-xl">🌐</span>
            <span className="flex-1 text-sm font-medium">{t('parent.ui_language')}</span>
            <span className="text-faint">›</span>
          </button>
        </div>
      </div>
    </div>
  );
}
