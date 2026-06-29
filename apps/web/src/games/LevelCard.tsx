/**
 * LevelCard — карточка уровня в хабе мини-игр в духе CS2: ранг-бейдж, полоса XP
 * которая «доезжает» с анимацией (и показывает «+N XP» за последнюю игру), и
 * интерактивный тап по полосе — пробегает световая волна. Прогресс кросс-девайс
 * (CloudStorage, см. [[srs]]).
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Flame } from 'lucide-react';

import { levelFromXp, clearLastGain, type XpState } from './srs';
import { initAudio, sfx } from './sound';

const TIERS = [
  { min: 11, key: 'legend', color: '#A78BFA' },
  { min: 8, key: 'master', color: '#38E1A4' },
  { min: 5, key: 'expert', color: '#F5B445' },
  { min: 3, key: 'student', color: '#9CA3AF' },
  { min: 1, key: 'novice', color: '#CD7F32' },
];
function tierFor(level: number) {
  return TIERS.find((t) => level >= t.min) ?? TIERS[TIERS.length - 1]!;
}

function RankBadge({ level, color }: { level: number; color: string }) {
  const chev = Math.min(5, Math.floor((level - 1) / 2) + 1);
  return (
    <svg width="50" height="50" viewBox="0 0 46 46" fill="none" aria-hidden>
      <defs>
        <linearGradient id="rankgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor="#0a0b10" />
        </linearGradient>
      </defs>
      <path
        d="M23 3 L40 9 V22 C40 32 32 39 23 43 C14 39 6 32 6 22 V9 Z"
        fill="url(#rankgrad)"
        stroke={color}
        strokeWidth="1.6"
      />
      <path
        d="M23 12.5 l2.7 5.5 6 .9 -4.35 4.25 1.03 6 -5.38-2.83 -5.38 2.83 1.03-6 -4.35-4.25 6-.9 Z"
        fill="#fff"
        fillOpacity="0.92"
      />
      {Array.from({ length: chev }).map((_, i) => (
        <path
          key={i}
          d={`M${15 + i * 4} 35.5 l1.6 1.6 1.6-1.6`}
          stroke="#fff"
          strokeOpacity="0.75"
          strokeWidth="1.3"
          fill="none"
        />
      ))}
    </svg>
  );
}

export function LevelCard({ xp, due }: { xp: XpState; due: number }) {
  const { t } = useTranslation();
  const lvl = levelFromXp(xp.xp);
  const tier = tierFor(lvl.level);
  const target = lvl.need ? lvl.into / lvl.need : 0;

  const [fill, setFill] = useState(0);
  const [showGain, setShowGain] = useState(false);
  const [shineKey, setShineKey] = useState(0);

  // Полоса доезжает к цели (при первом показе и при обновлении из облака).
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  // «+N XP» за последнюю игру → показать и затем сбросить флаг.
  useEffect(() => {
    if (xp.lastGain > 0) {
      setShowGain(true);
      const id = window.setTimeout(() => {
        setShowGain(false);
        clearLastGain();
      }, 2200);
      return () => clearTimeout(id);
    }
  }, [xp.lastGain]);

  const onTapBar = () => {
    setShineKey((k) => k + 1);
    try {
      WebApp.HapticFeedback.impactOccurred('light');
    } catch {
      /* вне TWA */
    }
    initAudio();
    sfx.tap();
  };

  return (
    <div className="glass-card relative mb-5 overflow-hidden rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <RankBadge level={lvl.level} color={tier.color} />
        <div className="min-w-0 flex-1">
          <div className="text-muted text-[11px] font-semibold uppercase tracking-wide">
            {t('games.level')} · {t(`games.rank.${tier.key}`)}
          </div>
          <div className="text-2xl font-bold" style={{ color: tier.color }}>
            {lvl.level}
          </div>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <div className="text-muted text-[11px] font-semibold uppercase tracking-wide">XP</div>
            <div className="text-lg font-bold tabular-nums">{xp.xp}</div>
          </div>
          <div>
            <div className="text-muted text-[11px] font-semibold uppercase tracking-wide">
              {t('games.learned')}
            </div>
            <div className="text-lg font-bold tabular-nums">{xp.learned}</div>
          </div>
        </div>
      </div>

      {/* полоса XP — тап = волна */}
      <button
        onClick={onTapBar}
        aria-label="xp"
        className="relative mt-3 block h-3 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--surface-2)' }}
      >
        <span className="xp-idle" />
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${fill * 100}%`,
            background: `linear-gradient(90deg, ${tier.color}, #5B9DFF)`,
            transition: 'width 1.1s cubic-bezier(.2,.8,.2,1)',
            boxShadow: `0 0 10px ${tier.color}88`,
          }}
        />
        {shineKey > 0 && <span key={shineKey} className="xp-shine" />}
      </button>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-faint text-[11px] tabular-nums">
          {lvl.into} / {lvl.need} XP
        </span>
        {showGain && (
          <span className="xp-gain text-[12px] font-bold" style={{ color: tier.color }}>
            +{xp.lastGain} XP
          </span>
        )}
      </div>

      {due > 0 && (
        <div className="text-warn mt-2 flex items-center gap-1.5 text-xs font-semibold">
          <Flame size={14} className="fill-current" />
          {t('games.due_now', { n: due })}
        </div>
      )}
    </div>
  );
}
