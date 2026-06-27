import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useLanguages } from '../api/languages';
import { useMyReferral, useRequestTrial, useCreateTicket } from '../api/quick-actions';
import { BottomSheet } from './BottomSheet';

type Screen = 'menu' | 'trial' | 'support' | 'referral';

interface Props {
  open: boolean;
  onClose: () => void;
}

// ─── Trial lesson form ────────────────────────────────────────────────────────

function TrialForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: languages } = useLanguages();
  const [langId, setLangId] = useState('');
  const [note, setNote] = useState('');
  const { mutate, isPending } = useRequestTrial();

  const submit = () => {
    if (!langId) return;
    mutate(
      { language_id: langId, note: note.trim() || undefined },
      {
        onSuccess: () => {
          WebApp.showAlert(t('quick_actions.trial_success'));
          onClose();
        },
        onError: (err: unknown) => {
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
            t('quick_actions.support_error');
          WebApp.showAlert(msg);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-tg-hint w-fit text-sm">
        {t('quick_actions.back')}
      </button>
      <h3 className="font-semibold">{t('quick_actions.trial_title')}</h3>
      <p className="text-tg-hint text-sm">{t('quick_actions.trial_sub')}</p>

      {/* Language picker */}
      <div className="flex flex-wrap gap-2">
        {languages?.map((l) => (
          <button
            key={l.id}
            onClick={() => setLangId(l.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
              langId === l.id ? 'text-white' : 'glass-option'
            }`}
            style={langId === l.id ? { backgroundColor: l.color ?? '#6366f1' } : {}}
          >
            {l.flag_emoji} {l.name_ru}
          </button>
        ))}
      </div>

      {/* Note */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t('quick_actions.trial_note_ph')}
        rows={3}
        className="glass-option w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
      />

      <button
        onClick={submit}
        disabled={!langId || isPending}
        className="glass-btn w-full rounded-2xl py-3 font-semibold disabled:opacity-50"
      >
        {isPending ? t('quick_actions.trial_sending') : t('quick_actions.trial_submit')}
      </button>
    </div>
  );
}

// ─── Support form ─────────────────────────────────────────────────────────────

function SupportForm({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const { mutate, isPending } = useCreateTicket();

  const submit = () => {
    if (subject.length < 3 || message.length < 10) return;
    mutate(
      { subject, message },
      {
        onSuccess: () => {
          WebApp.showAlert(t('quick_actions.support_success'));
          onClose();
        },
        onError: () => WebApp.showAlert(t('quick_actions.support_error')),
      },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-tg-hint w-fit text-sm">
        {t('quick_actions.back')}
      </button>
      <h3 className="font-semibold">{t('quick_actions.support_title')}</h3>

      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={t('quick_actions.support_subject_ph')}
        className="glass-option w-full rounded-xl px-4 py-3 text-sm outline-none"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('quick_actions.support_message_ph')}
        rows={5}
        className="glass-option w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
      />

      <button
        onClick={submit}
        disabled={subject.length < 3 || message.length < 10 || isPending}
        className="glass-btn w-full rounded-2xl py-3 font-semibold disabled:opacity-50"
      >
        {isPending ? t('quick_actions.support_sending') : t('quick_actions.support_submit')}
      </button>
    </div>
  );
}

// ─── Referral screen ──────────────────────────────────────────────────────────

function ReferralScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { data, isLoading } = useMyReferral();
  const appUrl = `https://t.me/linguolab_bot/app?startapp=ref_${data?.code ?? ''}`;

  const copyLink = () => {
    void navigator.clipboard.writeText(appUrl);
    WebApp.showAlert(t('quick_actions.referral_copied'));
  };

  return (
    <div className="flex flex-col gap-4">
      <button onClick={onBack} className="text-tg-hint w-fit text-sm">
        {t('quick_actions.back')}
      </button>
      <h3 className="font-semibold">{t('quick_actions.referral_title')}</h3>
      <p className="text-tg-hint text-sm">{t('quick_actions.referral_sub')}</p>

      {isLoading ? (
        <div className="glass-option h-12 animate-pulse rounded-xl" />
      ) : (
        <div className="glass-option flex items-center gap-2 rounded-xl px-4 py-3">
          <span className="text-tg-hint flex-1 truncate font-mono text-xs">{appUrl}</span>
          <button
            onClick={copyLink}
            className="glass-btn shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold"
          >
            {t('quick_actions.referral_copy')}
          </button>
        </div>
      )}

      {data && (
        <p className="text-tg-hint text-center text-xs">
          {t('quick_actions.referral_code_info', { code: data.code, count: data.used_count })}
        </p>
      )}
    </div>
  );
}

// ─── Main menu ────────────────────────────────────────────────────────────────

export function QuickActionsSheet({ open, onClose }: Props) {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>('menu');

  const ACTIONS = [
    {
      id: 'trial' as Screen,
      icon: '🎓',
      color: '#6366f1',
      label: t('quick_actions.action_trial_label'),
      desc: t('quick_actions.action_trial_desc'),
    },
    {
      id: 'referral' as Screen,
      icon: '🎁',
      color: '#00B894',
      label: t('quick_actions.action_referral_label'),
      desc: t('quick_actions.action_referral_desc'),
    },
    {
      id: 'support' as Screen,
      icon: '💬',
      color: '#0984E3',
      label: t('quick_actions.action_support_label'),
      desc: t('quick_actions.action_support_desc'),
    },
  ];

  const handleClose = () => {
    setScreen('menu');
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={screen === 'menu' ? t('quick_actions.sheet_title') : undefined}
    >
      {screen === 'menu' && (
        <div className="flex flex-col gap-2 pb-2">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              onClick={() => setScreen(a.id)}
              className="flex items-center gap-4 rounded-2xl px-4 py-4 text-left transition-opacity active:opacity-60"
              style={{
                background: 'var(--surface-2)',
                border: '1px solid var(--hairline)',
              }}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ background: `${a.color}22` }}
              >
                {a.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">{a.label}</p>
                <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--muted)' }}>
                  {a.desc}
                </p>
              </div>
              <span className="shrink-0 text-lg" style={{ color: 'var(--faint)' }}>
                ›
              </span>
            </button>
          ))}
        </div>
      )}

      {screen === 'trial' && <TrialForm onBack={() => setScreen('menu')} onClose={handleClose} />}
      {screen === 'support' && (
        <SupportForm onBack={() => setScreen('menu')} onClose={handleClose} />
      )}
      {screen === 'referral' && <ReferralScreen onBack={() => setScreen('menu')} />}
    </BottomSheet>
  );
}
