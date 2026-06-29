/**
 * LevelCard — карточка уровня в хабе в духе rank-up из CS2: чистый медальон с
 * уровнем (без «военных» шевронов), сегментированная полоса XP, которая
 * набирает значение с инерцией (быстро → медленно) под звук-трещотку, и тап по
 * полосе пускает световую волну. Прогресс кросс-девайс — см. [[srs]].
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Flame, Sparkles } from 'lucide-react';

import { levelFromXp, clearLastGain, type XpState } from './srs';
import { initAudio, sfx } from './sound';

const TIERS = [
  { min: 11, key: 'legend', color: '#A78BFA' },
  { min: 8, key: 'master', color: '#38E1A4' },
  { min: 5, key: 'expert', color: '#F5B445' },
  { min: 3, key: 'student', color: '#5B9DFF' },
  { min: 1, key: 'novice', color: '#9CA3AF' },
];
function tierFor(level: number) {
  return TIERS.find((t) => level >= t.min) ?? TIERS[TIERS.length - 1]!;
}

function Medallion({ level, color }: { level: number; color: string }) {
  return (
    <div
      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `radial-gradient(circle at 50% 35%, ${color}, #0a0b10 75%)`,
        boxShadow: `0 0 0 1.5px ${color}, 0 0 16px ${color}66`,
      }}
    >
      <Sparkles size={11} className="absolute right-1 top-1 text-white/70" />
      <span className="text-xl font-extrabold tabular-nums text-white">{level}</span>
    </div>
  );
}

export function LevelCard({ xp, due }: { xp: XpState; due: number }) {
  const { t } = useTranslation();

  const [dispXp, setDispXp] = useState(xp.lastGain > 0 ? Math.max(0, xp.xp - xp.lastGain) : 0);
  const [showGain, setShowGain] = useState(xp.lastGain > 0);
  const [earnedBlue, setEarnedBlue] = useState(!(xp.lastGain > 0));
  const [waves, setWaves] = useState<number[]>([]);
  const prevTargetRef = useRef(xp.lastGain > 0 ? Math.max(0, xp.xp - xp.lastGain) : 0);
  const rafRef = useRef<number | null>(null);

  // Полоса набирает XP с инерцией; озвучка-трещотка только когда есть реальный
  // прирост за игру (lastGain), при тихом обновлении из облака — без звука.
  useEffect(() => {
    const from = prevTargetRef.current;
    const target = xp.xp;
    prevTargetRef.current = target;
    if (from === target) {
      setDispXp(target);
      return;
    }
    const withSound = xp.lastGain > 0;
    const durMs = withSound ? Math.min(2200, Math.max(1200, xp.lastGain * 11)) : 1000;
    if (withSound) {
      initAudio();
      sfx.xpRamp(durMs / 1000);
      setEarnedBlue(false); // пока набирается — зелёный
    }
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durMs);
      const eased = 1 - Math.pow(1 - p, 2.4); // ease-out = инерция
      setDispXp(Math.round(from + (target - from) * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else {
        setEarnedBlue(true); // набрался — плавно в синий
        if (withSound) {
          clearLastGain();
          setShowGain(false);
        }
      }
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xp.xp]);

  const dl = levelFromXp(dispXp);
  const tier = tierFor(dl.level);
  const fill = dl.need ? dl.into / dl.need : 0;
  // База (что было до игры) — синим; прирост — зелёный, потом плавно в синий.
  const hadXp = Math.max(0, xp.xp - xp.lastGain);
  const hadLvl = levelFromXp(hadXp);
  const baseFill =
    hadLvl.level === dl.level
      ? dl.need
        ? hadLvl.into / dl.need
        : 0
      : hadLvl.level < dl.level
        ? 0
        : fill;
  const earnedW = Math.max(0, fill - baseFill);

  const onTapBar = () => {
    const id = performance.now();
    setWaves((w) => [...w, id]);
    window.setTimeout(() => setWaves((w) => w.filter((x) => x !== id)), 850);
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
        <Medallion level={dl.level} color={tier.color} />
        <div className="min-w-0 flex-1">
          <div className="text-muted text-[11px] font-semibold uppercase tracking-wide">
            {t('games.level')}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold" style={{ color: tier.color }}>
              {t(`games.rank.${tier.key}`)}
            </span>
            {showGain && (
              <span className="xp-gain text-xs font-bold" style={{ color: '#38E1A4' }}>
                +{xp.lastGain} XP
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-muted text-[11px] font-semibold uppercase tracking-wide">
            {t('games.learned')}
          </div>
          <div className="text-lg font-bold tabular-nums">{xp.learned}</div>
        </div>
      </div>

      {/* сегментированная полоса XP — тап = волна */}
      <button
        onClick={onTapBar}
        aria-label="xp"
        className="border-hairline relative mt-3 block h-4 w-full overflow-hidden rounded-md border"
        style={{ background: 'var(--surface-2)' }}
      >
        {/* база — то, что уже было — синим */}
        <div
          className="absolute inset-y-0 left-0"
          style={{ width: `${baseFill * 100}%`, background: '#5B9DFF' }}
        />
        {/* прирост за игру — пока набирается зелёный, затем плавно в синий;
            жёлтая рамка подсвечивает растягивающийся кусок */}
        {earnedW > 0 && (
          <div
            className="absolute inset-y-0"
            style={{
              left: `${baseFill * 100}%`,
              width: `${earnedW * 100}%`,
              background: earnedBlue ? '#5B9DFF' : '#38E1A4',
              boxShadow: earnedBlue ? 'none' : 'inset 0 0 0 1.5px #F5B445',
              transition: 'background-color .7s ease, box-shadow .7s ease',
            }}
          />
        )}
        {/* волна — только по тапу, новый элемент на каждый тап */}
        {waves.map((id) => (
          <span key={id} className="xp-shine" />
        ))}
      </button>

      <div className="text-faint mt-1.5 flex items-center justify-between text-[11px] tabular-nums">
        <span>
          {dl.into} / {dl.need} XP
        </span>
        <span>{dispXp} XP</span>
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
