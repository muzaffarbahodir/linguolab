import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../hooks/useBackButton';
import {
  useNotifications,
  useMarkAllRead,
  useMarkRead,
  useSendTestNotification,
  type NotificationItem,
} from '../api/notifications';
import { toast } from '../store/toast';
import { EmptyState } from '../components/EmptyState';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  lesson_reminder: '🔔',
  homework_new: '📚',
  grade_received: '📝',
  payment_confirmed: '✅',
  payment_refunded: '↩️',
  parent_child_absent: '⚠️',
  parent_child_homework_new: '📚',
  parent_child_grade_received: '📝',
  welcome: '👋',
  retention_reminder: '📖',
  homework_overdue: '⏰',
  broadcast: '📢',
};

function timeAgo(iso: string, t: TFunction): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t('notifications.just_now');
  if (min < 60) return t('notifications.min_ago', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('notifications.hour_ago', { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t('notifications.day_ago', { n: d });
  // Fallback: Intl date formatting using current i18n locale
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ─── NotificationCard ─────────────────────────────────────────────────────────

function NotificationCard({ notif }: { notif: NotificationItem }) {
  const { t } = useTranslation();
  const markRead = useMarkRead();
  const isRead = !!notif.read_at;
  const icon = TYPE_ICON[notif.type] ?? '🔔';

  function handleTap() {
    if (!isRead) {
      markRead.mutate(notif.id);
      WebApp.HapticFeedback.selectionChanged();
    }
  }

  return (
    <div
      onClick={handleTap}
      className={`press flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 ${
        isRead ? 'border-surface-2 bg-white/[0.03]' : 'bg-brand/10 border-brand/25'
      }`}
    >
      {/* Icon */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ${
          isRead ? 'bg-surface-2' : 'bg-brand/20'
        }`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">{notif.title}</p>
          {!isRead && <span className="bg-brand mt-0.5 h-2 w-2 shrink-0 rounded-full" />}
        </div>
        {/* Текст, а НЕ innerHTML: React экранирует → защита от stored XSS
            (в body сервер подставляет имена/названия). HTML-теги форматирования
            Telegram (<b> и т.п.) вырезаем, переносы строк — через CSS. */}
        <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed text-white/70">
          {notif.body.replace(/<[^>]*>/g, '')}
        </p>
        <p className="text-tg-hint mt-1 text-[10px]">{timeAgo(notif.created_at, t)}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useNotifications();
  const markAll = useMarkAllRead();
  const sendTest = useSendTestNotification();

  const unreadCount = data?.filter((n) => !n.read_at).length ?? 0;

  useBackButton(() => navigate(-1));

  function handleTest() {
    sendTest.mutate(undefined, {
      onSuccess: () => {
        toast.success(t('notifications.test_sent'));
      },
      onError: () => {
        toast.error(t('notifications.test_error'));
      },
    });
  }

  return (
    <div className="glass-fade-in min-h-screen pb-8">
      {/* Header */}
      <div className="glass px-4 pb-3 pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`text-xl ${unreadCount > 0 ? 'bell-ring' : ''}`}>🔔</span>
            <h1 className="text-lg font-bold">{t('notifications.title')}</h1>
            {unreadCount > 0 && (
              <span className="bg-brand rounded-full px-2 py-0.5 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={() => {
                  markAll.mutate();
                  WebApp.HapticFeedback.notificationOccurred('success');
                }}
                className="text-brand press text-xs font-medium"
                disabled={markAll.isPending}
              >
                {t('notifications.mark_all_read')}
              </button>
            )}
            <button
              onClick={handleTest}
              disabled={sendTest.isPending}
              className="bg-surface-2 text-muted press rounded-xl px-3 py-1.5 text-xs font-medium disabled:opacity-40"
            >
              {sendTest.isPending ? '...' : t('notifications.test_btn')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {isError && <EmptyState emoji="⚠️" title={t('notifications.load_error')} />}

        {!isLoading && !isError && (!data || data.length === 0) && (
          <EmptyState
            emoji="🔔"
            title={t('notifications.empty')}
            subtitle={t('notifications.empty_sub')}
            action={{ label: t('notifications.test_full_btn'), onClick: handleTest }}
          />
        )}

        {data && data.length > 0 && (
          <div className="stagger flex flex-col gap-2">
            {data.map((n) => (
              <NotificationCard key={n.id} notif={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
