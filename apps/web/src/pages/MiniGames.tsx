/**
 * MiniGamesPage — хаб мини-игр для запоминания слов. Показывает общий XP/уровень
 * и список игр (готовые + «скоро»). Route: /mini-games
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gamepad2, Zap, LayoutDashboard, Network, Timer, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { DECKS } from '../games/decks';
import { loadSrs, dueCount, loadXp, pullCloud, type XpState } from '../games/srs';
import { LevelCard } from '../games/LevelCard';

interface GameItem {
  id: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  to?: string;
  soon?: boolean;
}

export function MiniGamesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useBackButton(() => navigate('/profile'));

  const allIds = useMemo(() => DECKS.flatMap((d) => d.cards.map((c) => c.id)), []);
  const [xp, setXp] = useState<XpState>(() => loadXp());
  const [due, setDue] = useState(() => dueCount(loadSrs(), allIds));

  // Тянем прогресс из CloudStorage (кросс-девайс) и обновляем карточку.
  useEffect(() => {
    pullCloud((merged) => {
      setXp(merged);
      setDue(dueCount(loadSrs(), allIds));
    });
  }, [allIds]);

  const games: GameItem[] = [
    {
      id: 'reactor',
      title: t('games.reactor.title'),
      desc: t('games.reactor.desc'),
      icon: Zap,
      color: '#38E1A4',
      to: '/mini-games/reactor',
    },
    {
      id: 'dashboard',
      title: t('games.dashboard.title'),
      desc: t('games.dashboard.desc'),
      icon: LayoutDashboard,
      color: '#5B9DFF',
      to: '/mini-games/dashboard',
    },
    {
      id: 'chain',
      title: t('games.chain.title'),
      desc: t('games.chain.desc'),
      icon: Network,
      color: '#F5B445',
      to: '/mini-games/chain',
    },
    {
      id: 'reflex',
      title: t('games.reflex.title'),
      desc: t('games.reflex.desc'),
      icon: Timer,
      color: '#A78BFA',
      to: '/mini-games/reflex',
    },
  ];

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-12 pt-6">
      <div className="mb-1 flex items-center gap-2">
        <Gamepad2 size={22} className="text-brand" />
        <h1 className="text-xl font-bold">{t('games.title')}</h1>
      </div>
      <p className="text-muted mb-4 text-sm">{t('games.subtitle')}</p>

      {/* XP / уровень — анимированная карточка в духе CS2 */}
      <LevelCard xp={xp} due={due} />

      {/* список игр */}
      <div className="flex flex-col gap-3">
        {games.map((g) => {
          const Icon = g.icon;
          return (
            <button
              key={g.id}
              disabled={g.soon}
              onClick={() => g.to && navigate(g.to)}
              className={`glass-card press flex items-center gap-3 rounded-2xl p-4 text-left ${
                g.soon ? 'opacity-60' : ''
              }`}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ background: `${g.color}1f`, color: g.color }}
              >
                <Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{g.title}</span>
                  {g.soon && (
                    <span className="bg-surface-2 text-muted rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      {t('games.soon')}
                    </span>
                  )}
                </div>
                <p className="text-muted mt-0.5 truncate text-xs">{g.desc}</p>
              </div>
              {!g.soon && <ChevronRight size={18} className="text-faint shrink-0" />}
            </button>
          );
        })}
      </div>

      <p className="text-faint mt-5 text-center text-xs">{t('games.footer')}</p>
    </div>
  );
}
