/**
 * Рефлекс — быстрый квиз на скорость. Слово крупно по центру, снизу чипы-переводы,
 * таймер-бар сливается. Тапни верный быстрее — больше очков и комбо. Под капотом
 * тот же SRS-движок ([[srs]]). Route: /mini-games/reflex
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ScoreCounter } from '../../games/ScoreCounter';
import { DiscoBurst, DiscoRays } from '../../games/DiscoBurst';

type Phase = 'intro' | 'play' | 'over';
const LIVES = 3;
const ACCENT = '#A78BFA';

function haptic(kind: 'light' | 'medium' | 'success' | 'error'): void {
  try {
    const h = WebApp.HapticFeedback;
    if (kind === 'success' || kind === 'error') h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch {
    /* вне TWA */
  }
}

interface Option {
  text: string;
  correct: boolean;
}
interface Result {
  score: number;
  bestCombo: number;
  practiced: number;
  xpGain: number;
  capped: boolean;
  levelBefore: number;
  levelAfter: number;
}

export function ReflexGamePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const initialDeck = (params.get('deck') as DeckId) ?? 'en_basics';
  const [deckId, setDeckId] = useState<DeckId>(
    DECKS.some((d) => d.id === initialDeck) ? initialDeck : 'en_basics',
  );
  const deck = useMemo(() => getDeck(deckId), [deckId]);
  const deckIds = useMemo(() => deck.cards.map((c) => c.id), [deck]);

  const [phase, setPhase] = useState<Phase>('intro');
  const [word, setWord] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [bar, setBar] = useState(1);
  const [flash, setFlash] = useState<'none' | 'good' | 'bad'>('none');
  const [hud, setHud] = useState({ score: 0, combo: 0, lives: LIVES, level: 1 });
  const [result, setResult] = useState<Result | null>(null);

  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const startRef = useRef(0);
  const durRef = useRef(3000);
  const resolvingRef = useRef(false);
  const srsRef = useRef<Record<string, CardState>>({});
  const queueRef = useRef<string[]>([]);
  const qIdxRef = useRef(0);
  const targetRef = useRef<WordCard | null>(null);
  const statsRef = useRef({ score: 0, combo: 0, bestCombo: 0, lives: LIVES, level: 1, xpGain: 0 });
  const practicedRef = useRef<Set<string>>(new Set());

  const dueNow = useMemo(() => dueCount(loadSrs(), deckIds), [deckIds]);
  const xp0 = useMemo(() => loadXp(), []);
  const lvl0 = levelFromXp(xp0.xp);

  useBackButton(() => navigate('/mini-games'));

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);
  useEffect(() => () => stopLoop(), [stopLoop]);
  useEffect(() => {
    try {
      WebApp.expand();
    } catch {
      /* вне TWA */
    }
  }, []);

  const nextRound = useCallback(() => {
    const cards = deck.cards;
    const queue = queueRef.current;
    if (queue.length === 0) return;
    const targetId = queue[qIdxRef.current % queue.length]!;
    qIdxRef.current += 1;
    const target = cards.find((c) => c.id === targetId) ?? cards[0]!;
    targetRef.current = target;

    const level = statsRef.current.level;
    const optionCount = level >= 3 ? 4 : 3;
    const correctText = cardPrompt(target, i18n.language);
    const distractors = cards
      .filter((c) => cardPrompt(c, i18n.language) !== correctText)
      .sort(() => Math.random() - 0.5)
      .slice(0, optionCount - 1)
      .map((c) => ({ text: cardPrompt(c, i18n.language), correct: false }));
    const opts = [{ text: correctText, correct: true }, ...distractors].sort(
      () => Math.random() - 0.5,
    );

    durRef.current = Math.max(1300, 3000 - (level - 1) * 250);
    startRef.current = performance.now();
    resolvingRef.current = false;
    setWord(target.w);
    setOptions(opts);
    setPicked(null);
    setBar(1);
  }, [deck, i18n.language]);

  const endGame = useCallback(() => {
    stopLoop();
    saveSrs(srsRef.current);
    const s = statsRef.current;
    const before = levelFromXp(loadXp().xp).level;
    const res = commitGameResult({
      gameId: 'reflex',
      xpGain: s.xpGain,
      score: s.score,
      learnedGain: practicedRef.current.size,
    });
    setResult({
      score: s.score,
      bestCombo: s.bestCombo,
      practiced: practicedRef.current.size,
      xpGain: res.awardedXp,
      capped: res.capped,
      levelBefore: before,
      levelAfter: levelFromXp(res.xp.xp).level,
    });
    sfx.tada();
    setPhase('over');
  }, [stopLoop]);

  const resolve = useCallback(
    (correct: boolean, index: number | null, remaining: number) => {
      if (resolvingRef.current) return;
      resolvingRef.current = true;
      const target = targetRef.current;
      if (!target) return;
      const prev = srsRef.current[target.id];
      const wasNew = !prev || prev.box === 0;
      srsRef.current = gradeCard(srsRef.current, target.id, correct);
      saveSrs(srsRef.current);

      const s = statsRef.current;
      setPicked(index);
      if (correct) {
        s.combo += 1;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        s.score += (10 + Math.round(remaining * 40)) * Math.min(s.combo, 6);
        s.xpGain += 4 + Math.min(s.combo, 10);
        if (wasNew) practicedRef.current.add(target.id);
        s.level = 1 + Math.floor(s.score / 100);
        haptic('success');
        sfx.correct();
        setFlash('good');
      } else {
        s.combo = 0;
        s.lives -= 1;
        haptic('error');
        sfx.wrong();
        setFlash('bad');
      }
      setHud({ score: s.score, combo: s.combo, lives: s.lives, level: s.level });
      window.setTimeout(() => setFlash('none'), 220);
      window.setTimeout(() => {
        if (s.lives <= 0) endGame();
        else nextRound();
      }, 380);
    },
    [endGame, nextRound],
  );

  const loop = useCallback(
    (now: number) => {
      if (!runningRef.current) return; // петля остановлена — не перезапускаемся
      if (!resolvingRef.current) {
        const remaining = 1 - (now - startRef.current) / durRef.current;
        setBar(Math.max(0, remaining));
        if (remaining <= 0) {
          resolve(false, -1, 0); // не успел — раскрываем верный
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    },
    [resolve],
  );

  const start = useCallback(() => {
    stopLoop(); // гасим прошлую петлю перед новой
    const map = loadSrs();
    srsRef.current = map;
    queueRef.current = prioritize(map, deckIds);
    qIdxRef.current = 0;
    statsRef.current = { score: 0, combo: 0, bestCombo: 0, lives: LIVES, level: 1, xpGain: 0 };
    practicedRef.current = new Set();
    initAudio();
    setHud({ score: 0, combo: 0, lives: LIVES, level: 1 });
    setResult(null);
    setPhase('play');
    nextRound();
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(loop);
  }, [deckIds, loop, nextRound, stopLoop]);

  const barColor = bar > 0.5 ? '#38E1A4' : bar > 0.25 ? '#F5B445' : '#FF5C7A';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden font-mono text-white"
      style={{ background: '#0a0b10' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(#161922 1px,transparent 1px),linear-gradient(90deg,#161922 1px,transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: flash === 'none' ? 0 : 0.18,
          background:
            flash === 'good'
              ? 'radial-gradient(circle at 50% 45%, #38E1A4, transparent 70%)'
              : 'radial-gradient(circle at 50% 45%, #FF5C7A, transparent 70%)',
        }}
      />
      {phase !== 'play' && <SoundToggle />}
      <DiscoBurst level={hud.level} label={t('games.level')} />

      {phase === 'intro' && (
        <Intro
          deckId={deckId}
          setDeckId={setDeckId}
          dueNow={dueNow}
          level={lvl0.level}
          onStart={start}
          onBack={() => navigate('/mini-games')}
        />
      )}

      {phase === 'play' && (
        <div className="relative z-10 flex h-full flex-col px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
          {/* HUD */}
          <div className="flex items-center justify-between">
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
              <ScoreCounter value={hud.score} className="text-lg font-bold tabular-nums" />
            </div>
            <div className="text-right">
              <div className="text-[10px] tracking-[2px] text-[#7c8595]">COMBO</div>
              <div className="text-lg font-bold tabular-nums" style={{ color: '#F5B445' }}>
                ×{hud.combo}
              </div>
            </div>
          </div>

          {/* слово + таймер */}
          <div className="flex flex-1 flex-col items-center justify-center">
            <span className="text-[10px] tracking-[2px] text-[#7c8595]">
              {t('reflex.tap_label')}
            </span>
            <div className="mt-3 text-4xl font-bold" style={{ color: '#eef1f6' }}>
              {word}
            </div>
            <div
              className="mt-6 h-2 w-full max-w-xs overflow-hidden rounded-full"
              style={{ background: '#11151d' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${bar * 100}%`,
                  background: barColor,
                  transition: 'width 60ms linear, background 200ms',
                }}
              />
            </div>
          </div>

          {/* варианты */}
          <div className="flex flex-col gap-2.5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            {options.map((o, i) => {
              const reveal = picked !== null;
              const isPicked = picked === i;
              const show = reveal && (o.correct || isPicked);
              return (
                <button
                  key={i}
                  disabled={reveal}
                  onClick={() => {
                    const remaining = Math.max(
                      0,
                      1 - (performance.now() - startRef.current) / durRef.current,
                    );
                    resolve(o.correct, i, remaining);
                  }}
                  className="rounded-2xl border py-4 text-base font-bold transition-colors"
                  style={{
                    borderColor: show
                      ? o.correct
                        ? '#38E1A4'
                        : '#FF5C7A'
                      : isPicked
                        ? ACCENT
                        : '#1c2230',
                    background: show
                      ? o.correct
                        ? 'rgba(56,225,164,.15)'
                        : 'rgba(255,92,122,.15)'
                      : '#11151d',
                    color: show ? (o.correct ? '#38E1A4' : '#FF5C7A') : '#eef1f6',
                  }}
                >
                  {o.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {phase === 'over' && result && (
        <Over result={result} onAgain={start} onHub={() => navigate('/mini-games')} t={t} />
      )}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="rounded-xl border px-2 py-2.5 text-center"
      style={{ borderColor: '#1c2230', background: '#10131b' }}
    >
      <div className="text-base font-bold tabular-nums" style={{ color }}>
        {value}
      </div>
      <div className="mt-0.5 text-[9px] tracking-[1px] text-[#7c8595]">{label}</div>
    </div>
  );
}

function Intro({
  deckId,
  setDeckId,
  dueNow,
  level,
  onStart,
  onBack,
}: {
  deckId: DeckId;
  setDeckId: (d: DeckId) => void;
  dueNow: number;
  level: number;
  onStart: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative z-10 flex h-full flex-col items-center overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+2rem)] text-center">
      <span className="text-[10px] tracking-[3px] text-[#7c8595]">LINGUOLAB · MINI-GAME</span>
      <h1 className="mt-2 text-[26px] font-bold leading-tight">
        РЕ<span style={{ color: ACCENT }}>ФЛЕКС</span>
      </h1>
      <p className="mt-2 max-w-xs text-sm text-[#9aa3b2]">{t('reflex.how')}</p>

      <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-2">
        <Metric label={t('reflex.due')} value={`${dueNow}`} color="#38E1A4" />
        <Metric label={t('reflex.your_level')} value={`${level}`} color={ACCENT} />
      </div>

      <div className="mt-5 w-full max-w-xs">
        <div className="mb-2 text-left text-[10px] tracking-[2px] text-[#7c8595]">
          {t('reflex.deck')}
        </div>
        <div className="flex flex-col gap-2">
          {DECKS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDeckId(d.id)}
              className="flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors"
              style={{
                borderColor: d.id === deckId ? 'rgba(167,139,250,.6)' : '#1c2230',
                background: d.id === deckId ? 'rgba(167,139,250,.1)' : '#10131b',
                color: d.id === deckId ? ACCENT : '#cfd5df',
              }}
            >
              <span>
                {d.flag} {d.title}
              </span>
              <span className="text-[10px] text-[#7c8595]">
                {d.cards.length} {t('reflex.words')}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto w-full max-w-xs pt-6">
        <button
          onClick={onStart}
          className="press w-full rounded-2xl py-4 text-base font-bold text-black"
          style={{
            background: 'linear-gradient(180deg,#A78BFA,#7c5cf0)',
            boxShadow: '0 8px 24px rgba(167,139,250,.3)',
          }}
        >
          ▶ {t('reflex.start')}
        </button>
        <button onClick={onBack} className="mt-3 w-full py-2 text-sm text-[#7c8595]">
          {t('reflex.exit')}
        </button>
      </div>
    </div>
  );
}

function Over({
  result,
  onAgain,
  onHub,
  t,
}: {
  result: Result;
  onAgain: () => void;
  onHub: () => void;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const leveledUp = result.levelAfter > result.levelBefore;
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-[calc(env(safe-area-inset-top)+1.5rem)] text-center">
      <DiscoRays />
      <span className="text-[10px] tracking-[3px] text-[#7c8595]">{t('reflex.game_over')}</span>
      <div className="mt-2 text-6xl font-bold tabular-nums" style={{ color: ACCENT }}>
        {result.score}
      </div>
      <span className="mt-1 text-xs tracking-[2px] text-[#7c8595]">SCORE</span>

      <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-2">
        <Metric label={t('reflex.best_combo')} value={`×${result.bestCombo}`} color="#F5B445" />
        <Metric label={t('reflex.practiced')} value={`${result.practiced}`} color="#38E1A4" />
        <Metric
          label="XP"
          value={result.capped ? '0' : `+${result.xpGain}`}
          color={result.capped ? '#7c8595' : ACCENT}
        />
      </div>

      {result.capped && (
        <p className="mt-4 max-w-xs text-xs leading-relaxed text-[#9aa3b2]">
          {t('games.xp_capped')}
        </p>
      )}

      {!result.capped && leveledUp && (
        <div
          className="mt-5 flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold"
          style={{
            borderColor: 'rgba(167,139,250,.5)',
            background: 'rgba(167,139,250,.1)',
            color: ACCENT,
          }}
        >
          <Zap size={16} className="fill-current" />
          {t('reflex.level_up', { n: result.levelAfter })}
        </div>
      )}

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onAgain}
          className="press flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-black"
          style={{ background: 'linear-gradient(180deg,#A78BFA,#7c5cf0)' }}
        >
          <RotateCcw size={18} /> {t('reflex.again')}
        </button>
        <button
          onClick={onHub}
          className="flex items-center justify-center gap-2 rounded-2xl border py-3.5 font-semibold"
          style={{ borderColor: '#1c2230', color: '#cfd5df' }}
        >
          <Home size={18} /> {t('reflex.to_hub')}
        </button>
      </div>
    </div>
  );
}
