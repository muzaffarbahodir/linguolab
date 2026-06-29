/**
 * Слово-Реактор — мини-игра в стиле tech-reels: слова падают по «трубе» к ядру,
 * игрок тапает то, что значит подсказку. Под обёрткой — интервальное повторение
 * (SRS): игра подсовывает слова, которые пора закрепить. Route: /mini-games/reactor
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Heart, Zap, RotateCcw, Home } from 'lucide-react';

import { useBackButton } from '../../hooks/useBackButton';
import { DECKS, getDeck, cardPrompt, type DeckId, type WordCard } from '../../games/decks';
import {
  loadSrs,
  saveSrs,
  gradeCard,
  prioritize,
  dueCount,
  loadXp,
  levelFromXp,
  commitGameResult,
  type CardState,
} from '../../games/srs';
import { initAudio, sfx } from '../../games/sound';
import { SoundToggle } from '../../games/SoundToggle';

type Phase = 'intro' | 'play' | 'over';

interface Bubble {
  key: number;
  cardId: string;
  label: string;
  correct: boolean;
  x: number; // % center в полосе
  state: 'fall' | 'hit' | 'miss';
}

interface Burst {
  key: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
}

interface GameResult {
  score: number;
  bestCombo: number;
  practiced: number;
  xpGain: number;
  levelBefore: number;
  levelAfter: number;
}

const LIVES = 3;
const BUBBLE_H = 42;

function haptic(kind: 'light' | 'medium' | 'success' | 'error'): void {
  try {
    const h = WebApp.HapticFeedback;
    if (kind === 'success' || kind === 'error') h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch {
    /* вне TWA — нет вибро */
  }
}

export function WordReactorPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const initialDeck = (params.get('deck') as DeckId) ?? 'en_basics';
  const [deckId, setDeckId] = useState<DeckId>(
    DECKS.some((d) => d.id === initialDeck) ? initialDeck : 'en_basics',
  );
  const deck = useMemo(() => getDeck(deckId), [deckId]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState<{ prompt: string; bubbles: Bubble[] } | null>(null);
  const [groupY, setGroupY] = useState(0);
  const [hud, setHud] = useState({ score: 0, combo: 0, lives: LIVES, level: 1 });
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [flash, setFlash] = useState<'none' | 'good' | 'bad'>('none');

  // ─── изменяемое состояние движка (читает rAF, не триггерит ре-рендер) ──────
  const laneRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const yRef = useRef(0);
  const speedRef = useRef(120);
  const lastTsRef = useRef(0);
  const laneHRef = useRef(480);
  const queueRef = useRef<string[]>([]);
  const qIdxRef = useRef(0);
  const srsRef = useRef<Record<string, CardState>>({});
  const targetRef = useRef<WordCard | null>(null);
  const resolvingRef = useRef(false);
  const keyRef = useRef(1);
  const statsRef = useRef({ score: 0, combo: 0, bestCombo: 0, lives: LIVES, level: 1, xpGain: 0 });
  const practicedRef = useRef<Set<string>>(new Set());

  const dueNow = useMemo(() => {
    const map = loadSrs();
    return dueCount(
      map,
      deck.cards.map((c) => c.id),
    );
  }, [deck]);

  const xp = useMemo(() => loadXp(), []);
  const lvl = levelFromXp(xp.xp);

  useBackButton(() => navigate('/mini-games'));

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => () => stopLoop(), [stopLoop]);

  // Разворачиваем мини-апп на всю высоту — иначе игра не помещается в экран.
  useEffect(() => {
    try {
      WebApp.expand();
    } catch {
      /* вне TWA */
    }
  }, []);

  const speedForLevel = useCallback((level: number) => {
    const fallSec = Math.max(1.5, 2.9 - (level - 1) * 0.13);
    return laneHRef.current / fallSec;
  }, []);

  const spawnRound = useCallback(() => {
    const cards = deck.cards;
    const queue = queueRef.current;
    if (queue.length === 0) return;
    const targetId = queue[qIdxRef.current % queue.length]!;
    qIdxRef.current += 1;
    const target = cards.find((c) => c.id === targetId) ?? cards[0]!;
    targetRef.current = target;

    const level = statsRef.current.level;
    const optionCount = level >= 4 ? 4 : 3;
    const distractors = cards
      .filter((c) => c.w.toLowerCase() !== target.w.toLowerCase())
      .sort(() => Math.random() - 0.5)
      .slice(0, optionCount - 1);
    const chosen = [target, ...distractors].sort(() => Math.random() - 0.5);

    const bubbles: Bubble[] = chosen.map((c, i) => ({
      key: keyRef.current++,
      cardId: c.id,
      label: c.w,
      correct: c.id === target.id,
      x: ((i + 1) / (chosen.length + 1)) * 100,
      state: 'fall',
    }));

    yRef.current = 0;
    speedRef.current = speedForLevel(level);
    resolvingRef.current = false;
    setGroupY(0);
    setRound({ prompt: cardPrompt(target, i18n.language), bubbles });
  }, [deck, i18n.language, speedForLevel]);

  const endGame = useCallback(() => {
    stopLoop();
    saveSrs(srsRef.current);
    const s = statsRef.current;
    const before = levelFromXp(loadXp().xp).level;
    const newState = commitGameResult({
      gameId: 'reactor',
      xpGain: s.xpGain,
      score: s.score,
      learnedGain: practicedRef.current.size,
    });
    const after = levelFromXp(newState.xp).level;
    setResult({
      score: s.score,
      bestCombo: s.bestCombo,
      practiced: practicedRef.current.size,
      xpGain: Math.round(s.xpGain),
      levelBefore: before,
      levelAfter: after,
    });
    sfx.win();
    setPhase('over');
  }, [stopLoop]);

  const spawnBurst = useCallback((x: number, color: string) => {
    const y = ((laneHRef.current - BUBBLE_H) / laneHRef.current) * 100;
    const items: Burst[] = Array.from({ length: 7 }, () => {
      const a = Math.random() * Math.PI * 2;
      const d = 28 + Math.random() * 34;
      return {
        key: keyRef.current++,
        x: x + (Math.random() * 10 - 5),
        y,
        dx: Math.cos(a) * d,
        dy: Math.sin(a) * d,
        color,
      };
    });
    setBursts((b) => [...b, ...items]);
    window.setTimeout(() => {
      const keys = new Set(items.map((i) => i.key));
      setBursts((b) => b.filter((i) => !keys.has(i.key)));
    }, 600);
  }, []);

  const resolve = useCallback(
    (correct: boolean, tapped: Bubble | null) => {
      if (resolvingRef.current) return;
      resolvingRef.current = true;
      const target = targetRef.current;
      if (!target) return;

      const prev = srsRef.current[target.id];
      const wasNew = !prev || prev.box === 0;
      srsRef.current = gradeCard(srsRef.current, target.id, correct);
      saveSrs(srsRef.current);

      const s = statsRef.current;
      if (correct) {
        s.combo += 1;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        const gain = 10 * Math.min(s.combo, 8);
        s.score += gain;
        s.xpGain += 4 + Math.min(s.combo, 10);
        if (wasNew) practicedRef.current.add(target.id);
        s.level = 1 + Math.floor(s.score / 120);
        haptic('success');
        sfx.correct();
        setFlash('good');
        if (tapped) spawnBurst(tapped.x, '#38E1A4');
        setRound((r) =>
          r ? { ...r, bubbles: r.bubbles.map((b) => (b.correct ? { ...b, state: 'hit' } : b)) } : r,
        );
      } else {
        s.combo = 0;
        s.lives -= 1;
        haptic('error');
        sfx.wrong();
        setFlash('bad');
        if (tapped) spawnBurst(tapped.x, '#FF5C7A');
        setRound((r) =>
          r
            ? {
                ...r,
                bubbles: r.bubbles.map((b) =>
                  b.correct
                    ? { ...b, state: 'hit' }
                    : tapped && b.key === tapped.key
                      ? { ...b, state: 'miss' }
                      : b,
                ),
              }
            : r,
        );
      }
      setHud({ score: s.score, combo: s.combo, lives: s.lives, level: s.level });
      setTimeout(() => setFlash('none'), 220);

      window.setTimeout(() => {
        if (s.lives <= 0) endGame();
        else spawnRound();
      }, 360);
    },
    [endGame, spawnBurst, spawnRound],
  );

  const loop = useCallback(
    (ts: number) => {
      if (lastTsRef.current === 0) lastTsRef.current = ts;
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      if (!resolvingRef.current) {
        yRef.current += speedRef.current * dt;
        setGroupY(yRef.current);
        if (yRef.current >= laneHRef.current - BUBBLE_H) {
          resolve(false, null); // слово ушло в ядро — промах
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [resolve],
  );

  const startGame = useCallback(() => {
    const map = loadSrs();
    srsRef.current = map;
    queueRef.current = prioritize(
      map,
      deck.cards.map((c) => c.id),
    );
    qIdxRef.current = 0;
    statsRef.current = { score: 0, combo: 0, bestCombo: 0, lives: LIVES, level: 1, xpGain: 0 };
    practicedRef.current = new Set();
    laneHRef.current = laneRef.current?.clientHeight ?? 480;
    lastTsRef.current = 0;
    initAudio();
    setHud({ score: 0, combo: 0, lives: LIVES, level: 1 });
    setResult(null);
    setPhase('play');
    // дождёмся монтирования полосы перед первым раундом
    requestAnimationFrame(() => {
      laneHRef.current = laneRef.current?.clientHeight ?? 480;
      spawnRound();
      rafRef.current = requestAnimationFrame(loop);
    });
  }, [deck, loop, spawnRound]);

  // ─── рендер ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden font-mono text-white"
      style={{ background: '#0a0b10' }}
    >
      {/* сетка-фон */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(#161922 1px,transparent 1px),linear-gradient(90deg,#161922 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      {/* вспышка состояния */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: flash === 'none' ? 0 : 0.18,
          background:
            flash === 'good'
              ? 'radial-gradient(circle at 50% 80%, #38E1A4, transparent 70%)'
              : 'radial-gradient(circle at 50% 80%, #FF5C7A, transparent 70%)',
        }}
      />
      <SoundToggle />

      {phase === 'intro' && (
        <Intro
          deckId={deckId}
          setDeckId={setDeckId}
          dueNow={dueNow}
          level={lvl.level}
          onPlay={startGame}
          onBack={() => navigate('/mini-games')}
        />
      )}

      {phase === 'play' && round && (
        <div className="relative z-10 flex h-full flex-col">
          {/* HUD */}
          <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
            <div className="flex gap-1">
              {Array.from({ length: LIVES }).map((_, i) => (
                <Heart
                  key={i}
                  size={18}
                  className={i < hud.lives ? 'fill-current' : 'opacity-25'}
                  style={{ color: '#FF5C7A' }}
                />
              ))}
            </div>
            <div className="text-center">
              <div className="text-[10px] tracking-[2px] text-[#7c8595]">SCORE</div>
              <div className="text-lg font-bold tabular-nums">{hud.score}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] tracking-[2px] text-[#7c8595]">COMBO</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: '#F5B445' }}>
                ×{hud.combo}
              </div>
            </div>
          </div>

          {/* подсказка */}
          <div className="mt-3 flex flex-col items-center px-5">
            <span className="text-[10px] tracking-[2px] text-[#7c8595]">
              {t('reactor.catch_label')}
            </span>
            <div
              className="mt-1 rounded-xl border px-4 py-2 text-center"
              style={{ borderColor: 'rgba(56,225,164,.5)', background: '#10131b' }}
            >
              <span className="text-lg font-bold" style={{ color: '#38E1A4' }}>
                «{round.prompt}»
              </span>
            </div>
          </div>

          {/* полоса падения */}
          <div ref={laneRef} className="relative mt-3 flex-1 overflow-hidden">
            {/* центральная пунктирная линия */}
            <div
              className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2"
              style={{
                backgroundImage: 'repeating-linear-gradient(#1c2230 0 6px,transparent 6px 12px)',
              }}
            />
            {/* ядро (линия опасности) */}
            <div
              className="absolute inset-x-4 flex items-center justify-center"
              style={{ bottom: 8 }}
            >
              <div
                className="h-px flex-1"
                style={{ background: 'linear-gradient(90deg,transparent,#1c2230,transparent)' }}
              />
              <span className="px-2 text-[9px] tracking-[2px] text-[#4a5160]">ЯДРО</span>
              <div
                className="h-px flex-1"
                style={{ background: 'linear-gradient(90deg,transparent,#1c2230,transparent)' }}
              />
            </div>

            {/* пузырьки */}
            {round.bubbles.map((b) => (
              <button
                key={b.key}
                onClick={() => b.state === 'fall' && resolve(b.correct, b)}
                className="absolute max-w-[44vw] -translate-x-1/2 select-none truncate whitespace-nowrap rounded-full border px-3.5 text-sm font-bold transition-colors"
                style={{
                  left: `${b.x}%`,
                  top: groupY,
                  height: BUBBLE_H,
                  lineHeight: `${BUBBLE_H - 2}px`,
                  borderColor:
                    b.state === 'hit'
                      ? '#38E1A4'
                      : b.state === 'miss'
                        ? '#FF5C7A'
                        : 'rgba(124,133,149,.45)',
                  background:
                    b.state === 'hit'
                      ? 'rgba(56,225,164,.18)'
                      : b.state === 'miss'
                        ? 'rgba(255,92,122,.18)'
                        : '#11151d',
                  color: b.state === 'hit' ? '#38E1A4' : b.state === 'miss' ? '#FF5C7A' : '#eef1f6',
                  boxShadow: b.state === 'hit' ? '0 0 18px rgba(56,225,164,.5)' : 'none',
                }}
              >
                {b.label}
              </button>
            ))}

            {/* искры */}
            {bursts.map((bz) => (
              <span
                key={bz.key}
                className="reactor-burst pointer-events-none absolute h-1.5 w-1.5 rounded-full"
                style={
                  {
                    left: `${bz.x}%`,
                    top: `${bz.y}%`,
                    background: bz.color,
                    '--dx': `${bz.dx}px`,
                    '--dy': `${bz.dy}px`,
                  } as CSSProperties
                }
              />
            ))}
          </div>

          {/* нижний бар уровня */}
          <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2">
            <div className="mb-1 flex justify-between text-[10px] tracking-[2px] text-[#7c8595]">
              <span>{t('reactor.level', { n: hud.level })}</span>
              <span>
                {deck.flag} {deck.title}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: '#11151d' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(100, (hud.score % 120) / 1.2)}%`,
                  background: 'linear-gradient(90deg,#38E1A4,#5B9DFF)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {phase === 'over' && result && (
        <Over result={result} onAgain={startGame} onHub={() => navigate('/mini-games')} t={t} />
      )}

      <style>{`
        @keyframes reactorBurst {
          from { transform: translate(0,0) scale(1); opacity: 1; }
          to { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
        .reactor-burst {
          animation: reactorBurst .6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// ─── Экран старта ─────────────────────────────────────────────────────────────
function Intro({
  deckId,
  setDeckId,
  dueNow,
  level,
  onPlay,
  onBack,
}: {
  deckId: DeckId;
  setDeckId: (d: DeckId) => void;
  dueNow: number;
  level: number;
  onPlay: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative z-10 flex h-full flex-col items-center overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+2rem)] text-center">
      <span className="text-[10px] tracking-[3px] text-[#7c8595]">LINGUOLAB · MINI-GAME</span>
      <h1 className="mt-2 text-[26px] font-bold leading-tight">
        СЛОВО<span style={{ color: '#38E1A4' }}>-РЕАКТОР</span>
      </h1>
      <p className="mt-2 max-w-xs text-sm text-[#9aa3b2]">{t('reactor.how')}</p>

      <div
        className="mt-5 flex w-full max-w-xs items-center justify-between rounded-2xl border px-4 py-3"
        style={{ borderColor: '#1c2230', background: '#10131b' }}
      >
        <div className="text-left">
          <div className="text-[10px] tracking-[2px] text-[#7c8595]">{t('reactor.due')}</div>
          <div className="text-xl font-bold" style={{ color: '#38E1A4' }}>
            {dueNow}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] tracking-[2px] text-[#7c8595]">{t('reactor.your_level')}</div>
          <div className="text-xl font-bold" style={{ color: '#5B9DFF' }}>
            {level}
          </div>
        </div>
      </div>

      {/* выбор колоды */}
      <div className="mt-5 w-full max-w-xs">
        <div className="mb-2 text-left text-[10px] tracking-[2px] text-[#7c8595]">
          {t('reactor.deck')}
        </div>
        <div className="flex flex-col gap-2">
          {DECKS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDeckId(d.id)}
              className="flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors"
              style={{
                borderColor: d.id === deckId ? 'rgba(56,225,164,.6)' : '#1c2230',
                background: d.id === deckId ? 'rgba(56,225,164,.08)' : '#10131b',
                color: d.id === deckId ? '#38E1A4' : '#cfd5df',
              }}
            >
              <span>
                {d.flag} {d.title}
              </span>
              <span className="text-[10px] text-[#7c8595]">
                {d.cards.length} {t('reactor.words')}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto w-full max-w-xs pt-6">
        <button
          onClick={onPlay}
          className="press w-full rounded-2xl py-4 text-base font-bold text-black"
          style={{
            background: 'linear-gradient(180deg,#38E1A4,#1db88a)',
            boxShadow: '0 8px 24px rgba(56,225,164,.3)',
          }}
        >
          ▶ {t('reactor.play')}
        </button>
        <button onClick={onBack} className="mt-3 w-full py-2 text-sm text-[#7c8595]">
          {t('reactor.exit')}
        </button>
      </div>
    </div>
  );
}

// ─── Экран финала ─────────────────────────────────────────────────────────────
function Over({
  result,
  onAgain,
  onHub,
  t,
}: {
  result: GameResult;
  onAgain: () => void;
  onHub: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const leveledUp = result.levelAfter > result.levelBefore;
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-[calc(env(safe-area-inset-top)+1.5rem)] text-center">
      <span className="text-[10px] tracking-[3px] text-[#7c8595]">{t('reactor.game_over')}</span>
      <div className="mt-2 text-6xl font-bold tabular-nums" style={{ color: '#38E1A4' }}>
        {result.score}
      </div>
      <span className="mt-1 text-xs tracking-[2px] text-[#7c8595]">SCORE</span>

      <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-2">
        <Stat label={t('reactor.best_combo')} value={`×${result.bestCombo}`} color="#F5B445" />
        <Stat label={t('reactor.practiced')} value={`${result.practiced}`} color="#5B9DFF" />
        <Stat label="XP" value={`+${result.xpGain}`} color="#38E1A4" />
      </div>

      {leveledUp && (
        <div
          className="mt-5 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"
          style={{
            borderColor: 'rgba(245,180,69,.5)',
            background: 'rgba(245,180,69,.08)',
            color: '#F5B445',
          }}
        >
          <Zap size={16} className="fill-current" />
          {t('reactor.level_up', { n: result.levelAfter })}
        </div>
      )}

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onAgain}
          className="press flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-black"
          style={{ background: 'linear-gradient(180deg,#38E1A4,#1db88a)' }}
        >
          <RotateCcw size={18} /> {t('reactor.again')}
        </button>
        <button
          onClick={onHub}
          className="flex items-center justify-center gap-2 rounded-2xl border py-3.5 font-semibold"
          style={{ borderColor: '#1c2230', color: '#cfd5df' }}
        >
          <Home size={18} /> {t('reactor.to_hub')}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl border px-2 py-3"
      style={{ borderColor: '#1c2230', background: '#10131b' }}
    >
      <div className="text-lg font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[9px] tracking-[1px] text-[#7c8595]">{label}</div>
    </div>
  );
}
