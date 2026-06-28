/**
 * MiniGamesPage — заглушка «скоро»: залипательные мини-игры для запоминания слов.
 * Route: /mini-games
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gamepad2, Sparkles } from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';

export function MiniGamesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useBackButton(() => navigate('/profile'));

  return (
    <div className="glass-fade-in flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="bg-brand/12 relative flex h-20 w-20 items-center justify-center rounded-3xl">
        <Gamepad2 className="text-brand h-10 w-10" />
        <Sparkles className="text-warn absolute -right-1 -top-1 h-5 w-5 fill-current" />
      </div>
      <h1 className="text-2xl font-bold">{t('games.title')}</h1>
      <span className="bg-brand/15 text-brand-400 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide">
        {t('games.soon')}
      </span>
      <p className="text-muted max-w-xs text-sm leading-relaxed">{t('games.desc')}</p>
      <button
        onClick={() => navigate(-1)}
        className="glass-btn press mt-2 w-full max-w-xs rounded-2xl py-3 font-semibold"
      >
        {t('games.back')}
      </button>
    </div>
  );
}
