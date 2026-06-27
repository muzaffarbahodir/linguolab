/**
 * RoleGate — экран выбора роли для нового пользователя.
 * Заменяет тупик «ждите активации»: клиент сам выбирает «учусь сам» или
 * «я родитель» и сразу активируется (без ожидания менеджера).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useOnboard } from '../api/users';
import { useAuthStore } from '../store/auth';

type Choice = 'STUDENT' | 'PARENT';

export function RoleGate({ onBrowse }: { onBrowse?: () => void }) {
  const { t } = useTranslation();
  const onboard = useOnboard();
  const login = useAuthStore((s) => s.login);
  const [busy, setBusy] = useState<Choice | null>(null);

  const choose = (role: Choice) => {
    if (busy) return;
    setBusy(role);
    onboard.mutate(role, {
      onSuccess: async () => {
        try {
          WebApp.HapticFeedback.notificationOccurred('success');
        } catch {
          /* haptics могут отсутствовать */
        }
        // Перелогиниваемся — стор подхватит новую роль + is_active=true,
        // App перерисуется уже без гейта.
        try {
          await login(WebApp.initData);
        } catch {
          window.location.reload();
        }
      },
      onError: () => {
        setBusy(null);
        WebApp.showAlert(t('rolegate.error'));
      },
    });
  };

  const Card = ({
    role,
    emoji,
    color,
    title,
    desc,
  }: {
    role: Choice;
    emoji: string;
    color: string;
    title: string;
    desc: string;
  }) => (
    <button
      onClick={() => choose(role)}
      disabled={!!busy}
      className="press flex w-full items-center gap-4 rounded-2xl p-5 text-left disabled:opacity-60"
      style={{ background: `${color}14`, border: `1.5px solid ${color}40` }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
        style={{ background: `${color}22` }}
      >
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold" style={{ color }}>
          {title}
        </p>
        <p className="text-tg-hint mt-0.5 text-sm leading-snug">{desc}</p>
      </div>
      {busy === role ? (
        <div className="border-t-brand h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/30" />
      ) : (
        <span className="text-faint shrink-0 text-lg">→</span>
      )}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col justify-center gap-6 px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="text-center">
        <h1 className="shimmer-brand-text text-display mb-2">{t('rolegate.title')}</h1>
        <p className="text-tg-hint text-sm">{t('rolegate.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Card
          role="STUDENT"
          emoji="🎓"
          color="#C8623F"
          title={t('rolegate.student_title')}
          desc={t('rolegate.student_desc')}
        />
        <Card
          role="PARENT"
          emoji="👨‍👧"
          color="#10B981"
          title={t('rolegate.parent_title')}
          desc={t('rolegate.parent_desc')}
        />
      </div>

      {onBrowse && (
        <button
          onClick={onBrowse}
          className="press text-brand-400 text-center text-sm font-semibold underline"
        >
          {t('rolegate.browse')}
        </button>
      )}

      <p className="text-faint text-center text-xs">{t('rolegate.hint')}</p>
    </div>
  );
}
