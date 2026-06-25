/**
 * AdminBroadcast — рассылка сообщений в Telegram.
 * ADMIN / SUPER_ADMIN только.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import { useBroadcast } from '../../api/admin';

const MAX_LEN = 4096;

export function AdminBroadcastPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [target] = useState<'all'>('all');
  const [sent, setSent] = useState<number | null>(null);

  const broadcastMutation = useBroadcast();

  useBackButton(() => navigate('/admin'));

  const handleSend = () => {
    if (!message.trim()) {
      WebApp.showAlert(t('admin.broadcast.empty_msg_alert'));
      return;
    }

    WebApp.showConfirm(
      t('admin.broadcast.confirm', {
        preview: `${message.slice(0, 100)}${message.length > 100 ? '...' : ''}`,
      }),
      (ok) => {
        if (!ok) return;
        broadcastMutation.mutate(
          { message: message.trim(), target },
          {
            onSuccess: (data) => {
              setSent(data.queued);
              setMessage('');
              WebApp.HapticFeedback.notificationOccurred('success');
            },
            onError: (e) => {
              WebApp.showAlert(
                t('admin.broadcast.error_alert', { msg: e instanceof Error ? e.message : '?' }),
              );
            },
          },
        );
      },
    );
  };

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold">{t('admin.broadcast.page_title')}</h1>
        <p className="text-tg-hint mt-0.5 text-sm">{t('admin.broadcast.page_subtitle')}</p>
      </div>

      {/* Success banner */}
      {sent !== null && (
        <div className="bg-ok/15 border-ok/30 text-ok mb-4 rounded-2xl border p-4">
          <p className="font-semibold">{t('admin.broadcast.sent_title')}</p>
          <p className="mt-0.5 text-sm">{t('admin.broadcast.queued', { n: sent })}</p>
        </div>
      )}

      {/* Target info */}
      <div className="bg-surface border-hairline mb-4 rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="text-sm font-semibold">{t('admin.broadcast.target_label')}</p>
            <p className="text-tg-hint text-xs">{t('admin.broadcast.target_limit')}</p>
          </div>
        </div>
      </div>

      {/* Message textarea */}
      <div className="mb-4">
        <label className="text-tg-hint mb-2 block text-xs font-semibold uppercase tracking-wide">
          {t('admin.broadcast.message_label')}
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
          rows={8}
          placeholder={t('admin.broadcast.message_full_ph')}
          className="bg-surface-2 border-hairline w-full resize-none rounded-2xl border px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-violet-500"
        />
        <div className="mt-1 text-right">
          <span
            className={`text-xs ${message.length > MAX_LEN * 0.9 ? 'text-danger' : 'text-faint'}`}
          >
            {message.length} / {MAX_LEN}
          </span>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-warn/10 border-warn/20 mb-5 rounded-2xl border p-4">
        <p className="text-warn mb-1 text-xs font-semibold">{t('admin.broadcast.warn_title')}</p>
        <ul className="space-y-1 text-xs text-white/60">
          <li>• {t('admin.broadcast.warn_1')}</li>
          <li>• {t('admin.broadcast.warn_2')}</li>
          <li>• {t('admin.broadcast.warn_3')}</li>
        </ul>
      </div>

      <button
        onClick={handleSend}
        disabled={broadcastMutation.isPending || !message.trim()}
        className="glass-btn press w-full rounded-2xl py-3.5 font-bold disabled:opacity-60"
      >
        {broadcastMutation.isPending
          ? t('admin.broadcast.sending_btn')
          : t('admin.broadcast.send_btn')}
      </button>
    </div>
  );
}
