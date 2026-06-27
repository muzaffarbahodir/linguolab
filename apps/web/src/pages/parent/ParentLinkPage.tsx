import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import { useAcceptInvite } from '../../api/parents';

/**
 * ParentLinkPage — студент вводит код от родителя.
 * Доступна через /parent/link (добавить в BottomNav / Profile для студента).
 */
export function ParentLinkPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const accept = useAcceptInvite();

  useBackButton(() => navigate(-1));

  const handleSubmit = () => {
    const trimmed = code.trim();
    if (!trimmed) return;

    accept.mutate(trimmed, {
      onSuccess: () => {
        WebApp.HapticFeedback.notificationOccurred('success');
        WebApp.showAlert(t('parent.link_success'));
        navigate(-1);
      },
      onError: (err: unknown) => {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t('parent.link_error_code');
        WebApp.showAlert(msg);
      },
    });
  };

  return (
    <div className="glass-fade-in flex min-h-screen flex-col px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <h1 className="text-lg font-bold">{t('profile.invite_parent')}</h1>
      </div>

      {/* Icon */}
      <div className="mb-6 flex justify-center">
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full text-5xl"
          style={{ background: 'rgba(200,98,63,0.15)' }}
        >
          👨‍👩‍👦
        </div>
      </div>

      {/* Description */}
      <p className="mb-8 text-center text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
        {t('parent.link_page_desc')}
      </p>

      {/* Code input */}
      <div
        className="mb-4 overflow-hidden rounded-2xl"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('parent.link_parent_ph')}
          maxLength={50}
          className="w-full bg-transparent px-4 py-4 text-center font-mono text-lg font-bold tracking-widest outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-white/30"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={code.trim().length < 6 || accept.isPending}
        className="press w-full rounded-2xl py-4 font-bold text-white disabled:opacity-40"
        style={{ background: 'linear-gradient(135deg,#C8623F,#E0875A)' }}
      >
        {accept.isPending ? t('parent.link_checking') : t('parent.link_confirm')}
      </button>

      {/* Info */}
      <div
        className="mt-6 rounded-2xl px-4 py-3"
        style={{ background: 'rgba(200,98,63,0.08)', border: '1px solid rgba(200,98,63,0.15)' }}
      >
        <p className="text-xs leading-relaxed" style={{ color: 'var(--faint)' }}>
          {t('parent.link_page_info')}
        </p>
      </div>
    </div>
  );
}
