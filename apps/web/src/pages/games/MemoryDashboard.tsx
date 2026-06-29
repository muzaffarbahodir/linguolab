/**
 * Дашборд памяти — спокойный режим повторения в эстетике дашборда из reels.
 * Свайп-карточки: вспомни перевод, переверни, оцени «помню/не помню». Под капотом
 * тот же SRS-движок ([[srs]]) — слова с просроченным интервалом идут первыми.
 * Route: /mini-games/dashboard
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Check, X, Eye, RotateCcw, Home } from 'lucide-react';

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
import { DiscoRays } from '../../games/DiscoBurst';

type Phase = 'intro' | 'review' | 'over';
const SESSION_MAX = 15;
const MAX_BOX = 5;
const SWIPE_THRESHOLD = 88;

function haptic(kind: 'light' | 'medium' | 'success' | 'error'): void {
  try {
    const h = WebApp.HapticFeedback;
    if (kind === 'success' || kind === 'error') h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch {
    /* вне TWA */
  }
}

function deckMastery(map: Record<string, CardState>, ids: string[]): number {
  if (ids.length === 0) return 0;
  const sum = ids.reduce((acc, id) => acc + (map[id]?.box ?? 0), 0);
  return Math.round((sum / (ids.length * MAX_BOX)) * 100);
}

interface Result {
  reviewed: number;
  remembered: number;
  xpGain: number;
  capped: boolean;
  masteryBefore: number;
  masteryAfter: number;
  levelBefore: number;
  levelAfter: number;
}

export function MemoryDashboardPage() {
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
  const [queue, setQueue] = useState<WordCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const [hud, setHud] = useState({ reviewed: 0, remembered: 0, streak: 0 });
  const [result, setResult] = useState<Result | null>(null);

  const srsRef = useRef<Record<string, CardState>>({});
  const statsRef = useRef({ reviewed: 0, remembered: 0, streak: 0, bestStreak: 0, xpGain: 0 });
  const masteryBeforeRef = useRef(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);

  const dueNow = useMemo(() => dueCount(loadSrs(), deckIds), [deckIds]);
  const xp0 = useMemo(() => loadXp(), []);
  const lvl0 = levelFromXp(xp0.xp);

  useBackButton(() => navigate('/mini-games'));
  useEffect(() => {
    try {
      WebApp.expand();
    } catch {
      /* вне TWA */
    }
  }, []);

  const current = queue[idx] ?? null;

  const start = useCallback(() => {
    const map = loadSrs();
    srsRef.current = map;
    masteryBeforeRef.current = deckMastery(map, deckIds);
    const ordered = prioritize(map, deckIds);
    const session = ordered.slice(0, Math.min(SESSION_MAX, ordered.length));
    const cards = session
      .map((id) => deck.cards.find((c) => c.id === id))
      .filter((c): c is WordCard => Boolean(c));
    statsRef.current = { reviewed: 0, remembered: 0, streak: 0, bestStreak: 0, xpGain: 0 };
    initAudio();
    setQueue(cards);
    setIdx(0);
    setFlipped(false);
    setDrag(0);
    setLeaving(0);
    setHud({ reviewed: 0, remembered: 0, streak: 0 });
    setResult(null);
    setPhase('review');
  }, [deck, deckIds]);

  const finish = useCallback(() => {
    saveSrs(srsRef.current);
    const s = statsRef.current;
    const before = levelFromXp(loadXp().xp).level;
    const res = commitGameResult({
      gameId: 'dashboard',
      xpGain: s.xpGain,
      score: s.remembered,
      learnedGain: s.remembered,
    });
    setResult({
      reviewed: s.reviewed,
      remembered: s.remembered,
      xpGain: res.awardedXp,
      capped: res.capped,
      masteryBefore: masteryBeforeRef.current,
      masteryAfter: deckMastery(srsRef.current, deckIds),
      levelBefore: before,
      levelAfter: levelFromXp(res.xp.xp).level,
    });
    sfx.tada();
    setPhase('over');
  }, [deckIds]);

  const grade = useCallback(
    (remember: boolean) => {
      const card = current;
      if (!card || leaving !== 0) return;
      srsRef.current = gradeCard(srsRef.current, card.id, remember);
      saveSrs(srsRef.current);
      const s = statsRef.current;
      s.reviewed += 1;
      if (remember) {
        s.remembered += 1;
        s.streak += 1;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        s.xpGain += 4 + Math.min(s.streak, 6);
        haptic('success');
        sfx.correct();
      } else {
        s.streak = 0;
        s.xpGain += 1;
        haptic('error');
        sfx.wrong();
      }
      setHud({ reviewed: s.reviewed, remembered: s.remembered, streak: s.streak });
      setLeaving(remember ? 1 : -1);
      window.setTimeout(() => {
        const isLast = idx + 1 >= queue.length;
        if (isLast) finish();
        else {
          setIdx((i) => i + 1);
          setFlipped(false);
          setDrag(0);
          setLeaving(0);
        }
      }, 230);
    },
    [current, idx, queue.length, leaving, finish],
  );

  // ─── свайп ───────────────────────────────────────────────────────────────
  const onPointerDown = (e: ReactPointerEvent) => {
    if (leaving !== 0) return;
    draggingRef.current = true;
    startXRef.current = e.clientX;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!draggingRef.current) return;
    setDrag(e.clientX - startXRef.current);
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const dx = drag;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) grade(dx > 0);
    else setDrag(0);
  };

  const hint = drag > 24 ? 'remember' : drag < -24 ? 'forget' : 'none';
  const cardX = leaving !== 0 ? leaving * 600 : drag;

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
      <SoundToggle />

      {phase === 'intro' && (
        <Intro
          deckId={deckId}
          setDeckId={setDeckId}
          dueNow={dueNow}
          mastery={deckMastery(loadSrs(), deckIds)}
          level={lvl0.level}
          onStart={start}
          onBack={() => navigate('/mini-games')}
        />
      )}

      {phase === 'review' && current && (
        <div className="relative z-10 flex h-full flex-col px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
          {/* метрики сессии */}
          <div className="grid grid-cols-3 gap-2">
            <Metric
              label={t('dash.reviewed')}
              value={`${hud.reviewed}/${queue.length}`}
              color="#5B9DFF"
            />
            <Metric
              label={t('dash.remembered')}
              value={hud.reviewed ? `${Math.round((hud.remembered / hud.reviewed) * 100)}%` : '—'}
              color="#38E1A4"
            />
            <Metric label={t('dash.streak')} value={`×${hud.streak}`} color="#F5B445" />
          </div>

          {/* прогресс сессии */}
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full"
            style={{ background: '#11151d' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(hud.reviewed / queue.length) * 100}%`,
                background: 'linear-gradient(90deg,#5B9DFF,#38E1A4)',
              }}
            />
          </div>

          {/* карточка */}
          <div className="relative flex flex-1 items-center justify-center">
            {/* подсказки свайпа */}
            <SwipeBadge side="left" active={hint === 'forget'} />
            <SwipeBadge side="right" active={hint === 'remember'} />

            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={() => {
                if (Math.abs(drag) < 6) {
                  setFlipped((f) => !f);
                  sfx.tap();
                }
              }}
              className="relative flex w-full max-w-xs cursor-pointer touch-none select-none flex-col items-center justify-center rounded-3xl border px-6 py-10"
              style={{
                minHeight: 240,
                transform: `translateX(${cardX}px) rotate(${cardX * 0.035}deg)`,
                transition: draggingRef.current ? 'none' : 'transform .23s ease',
                borderColor:
                  hint === 'remember'
                    ? 'rgba(56,225,164,.7)'
                    : hint === 'forget'
                      ? 'rgba(255,92,122,.7)'
                      : '#1c2230',
                background: '#10131b',
                boxShadow:
                  hint === 'remember'
                    ? '0 0 30px rgba(56,225,164,.18)'
                    : hint === 'forget'
                      ? '0 0 30px rgba(255,92,122,.18)'
                      : 'none',
              }}
            >
              <span className="text-[10px] tracking-[2px] text-[#7c8595]">
                {deck.flag} {t('dash.recall')}
              </span>
              <span className="mt-3 text-3xl font-bold" style={{ color: '#eef1f6' }}>
                {current.w}
              </span>
              <div className="my-4 h-px w-2/3" style={{ background: '#1c2230' }} />
              {flipped ? (
                <span className="text-xl font-semibold" style={{ color: '#38E1A4' }}>
                  {cardPrompt(current, i18n.language)}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm text-[#7c8595]">
                  <Eye size={14} /> {t('dash.reveal')}
                </span>
              )}
            </div>
          </div>

          {/* кнопки оценки */}
          <div className="grid grid-cols-2 gap-3 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2">
            <button
              onClick={() => grade(false)}
              className="press flex items-center justify-center gap-2 rounded-2xl border py-4 font-bold"
              style={{
                borderColor: 'rgba(255,92,122,.5)',
                background: 'rgba(255,92,122,.08)',
                color: '#FF5C7A',
              }}
            >
              <X size={18} /> {t('dash.forget')}
            </button>
            <button
              onClick={() => grade(true)}
              className="press flex items-center justify-center gap-2 rounded-2xl border py-4 font-bold"
              style={{
                borderColor: 'rgba(56,225,164,.5)',
                background: 'rgba(56,225,164,.08)',
                color: '#38E1A4',
              }}
            >
              <Check size={18} /> {t('dash.remember')}
            </button>
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

function SwipeBadge({ side, active }: { side: 'left' | 'right'; active: boolean }) {
  const remember = side === 'right';
  return (
    <div
      className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full border px-3 py-1 text-xs font-bold transition-opacity"
      style={
        {
          [side]: 4,
          opacity: active ? 1 : 0.25,
          borderColor: remember ? 'rgba(56,225,164,.7)' : 'rgba(255,92,122,.7)',
          color: remember ? '#38E1A4' : '#FF5C7A',
          background: '#0a0b10',
        } as CSSProperties
      }
    >
      {remember ? '✓' : '✕'}
    </div>
  );
}

function Intro({
  deckId,
  setDeckId,
  dueNow,
  mastery,
  level,
  onStart,
  onBack,
}: {
  deckId: DeckId;
  setDeckId: (d: DeckId) => void;
  dueNow: number;
  mastery: number;
  level: number;
  onStart: () => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="relative z-10 flex h-full flex-col items-center overflow-y-auto px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+2rem)] text-center">
      <span className="text-[10px] tracking-[3px] text-[#7c8595]">LINGUOLAB · MINI-GAME</span>
      <h1 className="mt-2 text-[26px] font-bold leading-tight">
        ДАШБОРД<span style={{ color: '#5B9DFF' }}> ПАМЯТИ</span>
      </h1>
      <p className="mt-2 max-w-xs text-sm text-[#9aa3b2]">{t('dash.how')}</p>

      <div className="mt-5 grid w-full max-w-xs grid-cols-3 gap-2">
        <Metric label={t('dash.due')} value={`${dueNow}`} color="#38E1A4" />
        <Metric label={t('dash.mastery')} value={`${mastery}%`} color="#5B9DFF" />
        <Metric label={t('dash.your_level')} value={`${level}`} color="#F5B445" />
      </div>

      <div className="mt-5 w-full max-w-xs">
        <div className="mb-2 text-left text-[10px] tracking-[2px] text-[#7c8595]">
          {t('dash.deck')}
        </div>
        <div className="flex flex-col gap-2">
          {DECKS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDeckId(d.id)}
              className="flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors"
              style={{
                borderColor: d.id === deckId ? 'rgba(91,157,255,.6)' : '#1c2230',
                background: d.id === deckId ? 'rgba(91,157,255,.08)' : '#10131b',
                color: d.id === deckId ? '#5B9DFF' : '#cfd5df',
              }}
            >
              <span>
                {d.flag} {d.title}
              </span>
              <span className="text-[10px] text-[#7c8595]">
                {d.cards.length} {t('dash.words')}
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
            background: 'linear-gradient(180deg,#5B9DFF,#3f7fe0)',
            boxShadow: '0 8px 24px rgba(91,157,255,.3)',
          }}
        >
          ▶ {t('dash.start')}
        </button>
        <button onClick={onBack} className="mt-3 w-full py-2 text-sm text-[#7c8595]">
          {t('dash.exit')}
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
  const pct = result.reviewed ? Math.round((result.remembered / result.reviewed) * 100) : 0;
  const masteryUp = result.masteryAfter - result.masteryBefore;
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-[calc(env(safe-area-inset-top)+1.5rem)] text-center">
      <DiscoRays />
      <span className="text-[10px] tracking-[3px] text-[#7c8595]">{t('dash.done_title')}</span>
      <div className="mt-2 text-6xl font-bold tabular-nums" style={{ color: '#38E1A4' }}>
        {pct}%
      </div>
      <span className="mt-1 text-xs tracking-[2px] text-[#7c8595]">{t('dash.remembered')}</span>

      <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-2">
        <Metric label={t('dash.reviewed')} value={`${result.reviewed}`} color="#5B9DFF" />
        <Metric label={t('dash.mastery')} value={`${result.masteryAfter}%`} color="#5B9DFF" />
        <Metric
          label="XP"
          value={result.capped ? '0' : `+${result.xpGain}`}
          color={result.capped ? '#7c8595' : '#38E1A4'}
        />
      </div>

      {result.capped && (
        <p className="mt-4 max-w-xs text-xs leading-relaxed text-[#9aa3b2]">
          {t('games.xp_capped')}
        </p>
      )}

      {masteryUp > 0 && (
        <div
          className="mt-5 rounded-xl border px-4 py-2 text-sm font-bold"
          style={{
            borderColor: 'rgba(56,225,164,.5)',
            background: 'rgba(56,225,164,.08)',
            color: '#38E1A4',
          }}
        >
          {t('dash.mastery_up', { n: masteryUp })}
        </div>
      )}

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onAgain}
          className="press flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-black"
          style={{ background: 'linear-gradient(180deg,#5B9DFF,#3f7fe0)' }}
        >
          <RotateCcw size={18} /> {t('dash.again')}
        </button>
        <button
          onClick={onHub}
          className="flex items-center justify-center gap-2 rounded-2xl border py-3.5 font-semibold"
          style={{ borderColor: '#1c2230', color: '#cfd5df' }}
        >
          <Home size={18} /> {t('dash.to_hub')}
        </button>
      </div>
    </div>
  );
}
