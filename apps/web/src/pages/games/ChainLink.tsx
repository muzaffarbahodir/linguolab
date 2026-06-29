/**
 * Цепная связь — соединяй слово с переводом. Тапни плитку слева и её пару справа;
 * верно → между ними протягивается неоновая линия и плитки гаснут, доска
 * пополняется. Под капотом тот же SRS-движок ([[srs]]). Route: /mini-games/chain
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Heart, RotateCcw, Home } from 'lucide-react';

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
const PAIRS = 5;
const TILE_H = 54;
const GAP = 12;

function haptic(kind: 'light' | 'medium' | 'success' | 'error'): void {
  try {
    const h = WebApp.HapticFeedback;
    if (kind === 'success' || kind === 'error') h.notificationOccurred(kind);
    else h.impactOccurred(kind);
  } catch {
    /* вне TWA */
  }
}

function rowY(row: number): number {
  return row * (TILE_H + GAP) + TILE_H / 2;
}

interface Tile {
  pairId: string; // = card.id
  label: string;
  row: number;
}
interface Board {
  left: Tile[];
  right: Tile[];
}
interface Sel {
  side: 'L' | 'R';
  pairId: string;
}
interface Result {
  matched: number;
  boards: number;
  bestCombo: number;
  xpGain: number;
  capped: boolean;
  levelBefore: number;
  levelAfter: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

export function ChainLinkPage() {
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
  const [board, setBoard] = useState<Board | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Sel | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const [link, setLink] = useState<{ ly: number; ry: number } | null>(null);
  const [hud, setHud] = useState({ score: 0, combo: 0, lives: LIVES, boards: 0 });
  const [result, setResult] = useState<Result | null>(null);

  const srsRef = useRef<Record<string, CardState>>({});
  const queueRef = useRef<string[]>([]);
  const qIdxRef = useRef(0);
  const statsRef = useRef({
    matched: 0,
    boards: 0,
    combo: 0,
    bestCombo: 0,
    lives: LIVES,
    xpGain: 0,
  });
  const lockRef = useRef(false);

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

  const nextBoard = useCallback(() => {
    const queue = queueRef.current;
    const cards: WordCard[] = [];
    const seen = new Set<string>();
    let guard = 0;
    while (cards.length < PAIRS && guard < queue.length * 2) {
      const id = queue[qIdxRef.current % queue.length]!;
      qIdxRef.current += 1;
      guard += 1;
      if (seen.has(id)) continue;
      const card = deck.cards.find((c) => c.id === id);
      if (card) {
        seen.add(id);
        cards.push(card);
      }
    }
    const left: Tile[] = cards.map((c, i) => ({ pairId: c.id, label: c.w, row: i }));
    const right: Tile[] = shuffle(cards).map((c, i) => ({
      pairId: c.id,
      label: cardPrompt(c, i18n.language),
      row: i,
    }));
    setBoard({ left, right });
    setMatched(new Set());
    setSel(null);
    setLink(null);
  }, [deck, i18n.language]);

  const start = useCallback(() => {
    const map = loadSrs();
    srsRef.current = map;
    queueRef.current = prioritize(map, deckIds);
    qIdxRef.current = 0;
    statsRef.current = { matched: 0, boards: 0, combo: 0, bestCombo: 0, lives: LIVES, xpGain: 0 };
    lockRef.current = false;
    initAudio();
    setHud({ score: 0, combo: 0, lives: LIVES, boards: 0 });
    setResult(null);
    setPhase('play');
    nextBoard();
  }, [deckIds, nextBoard]);

  const finish = useCallback(() => {
    saveSrs(srsRef.current);
    const s = statsRef.current;
    const before = levelFromXp(loadXp().xp).level;
    const res = commitGameResult({
      gameId: 'chain',
      xpGain: s.xpGain,
      score: s.matched,
      learnedGain: s.matched,
    });
    setResult({
      matched: s.matched,
      boards: s.boards,
      bestCombo: s.bestCombo,
      xpGain: res.awardedXp,
      capped: res.capped,
      levelBefore: before,
      levelAfter: levelFromXp(res.xp.xp).level,
    });
    sfx.tada();
    setPhase('over');
  }, []);

  const tapTile = useCallback(
    (side: 'L' | 'R', pairId: string) => {
      if (lockRef.current || matched.has(pairId)) return;
      if (!sel) {
        setSel({ side, pairId });
        haptic('light');
        sfx.tap();
        return;
      }
      if (sel.side === side) {
        setSel({ side, pairId }); // переключаем выбор на той же стороне
        sfx.tap();
        return;
      }
      // выбраны две стороны — проверяем
      const s = statsRef.current;
      if (sel.pairId === pairId) {
        // совпадение
        srsRef.current = gradeCard(srsRef.current, pairId, true);
        saveSrs(srsRef.current);
        s.matched += 1;
        s.combo += 1;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        s.xpGain += 4 + Math.min(s.combo, 8);
        haptic('success');
        sfx.correct();
        // короткая изогнутая линия в зазоре — показываем одну за раз, не пересекаются
        const lt = board?.left.find((tl) => tl.pairId === pairId);
        const rt = board?.right.find((tr) => tr.pairId === pairId);
        if (lt && rt) {
          setLink({ ly: rowY(lt.row), ry: rowY(rt.row) });
          window.setTimeout(() => setLink(null), 460);
        }
        const nextMatched = new Set(matched);
        nextMatched.add(pairId);
        setMatched(nextMatched);
        setSel(null);
        if (nextMatched.size >= (board?.left.length ?? PAIRS)) {
          s.boards += 1; // диско-вспышка + звук уровня — через DiscoBurst(level=boards)
          lockRef.current = true;
          window.setTimeout(() => {
            lockRef.current = false;
            nextBoard();
          }, 600);
        }
        setHud({ score: s.matched, combo: s.combo, lives: s.lives, boards: s.boards });
      } else {
        // ошибка — засчитываем неверный ответ выбранному слову
        srsRef.current = gradeCard(srsRef.current, sel.pairId, false);
        saveSrs(srsRef.current);
        s.combo = 0;
        s.lives -= 1;
        haptic('error');
        sfx.wrong();
        setBad(pairId);
        setSel(null);
        setHud({ score: s.matched, combo: s.combo, lives: s.lives, boards: s.boards });
        window.setTimeout(() => setBad(null), 280);
        if (s.lives <= 0) {
          lockRef.current = true;
          window.setTimeout(finish, 320);
        }
      }
    },
    [sel, matched, board, nextBoard, finish],
  );

  const boardH = (board?.left.length ?? PAIRS) * (TILE_H + GAP) - GAP;

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
      <DiscoBurst level={hud.boards} label={t('games.level')} />

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

      {phase === 'play' && board && (
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

          <div className="mt-3 text-center text-[10px] tracking-[2px] text-[#7c8595]">
            {t('chain.connect')}
          </div>

          {/* доска */}
          <div className="flex flex-1 items-center justify-center">
            <div className="relative w-full max-w-sm" style={{ height: boardH }}>
              {/* связь — одна изогнутая линия в зазоре, показывается на миг;
                  начинается/кончается в промежутке, не касаясь плиток, и т.к.
                  одновременно видна только одна — линии не пересекаются */}
              {link && (
                <svg
                  key={`${link.ly}-${link.ry}`}
                  className="pointer-events-none absolute inset-0"
                  width="100%"
                  height={boardH}
                  viewBox={`0 0 100 ${boardH}`}
                  preserveAspectRatio="none"
                >
                  <path
                    d={`M 44 ${link.ly} C 50 ${link.ly}, 50 ${link.ry}, 56 ${link.ry}`}
                    fill="none"
                    stroke="#38E1A4"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    pathLength={1}
                    vectorEffect="non-scaling-stroke"
                    className="chain-line"
                    style={{ filter: 'drop-shadow(0 0 5px rgba(56,225,164,.8))' }}
                  />
                </svg>
              )}

              {/* колонки */}
              <div className="absolute inset-0 flex justify-between">
                <Column
                  tiles={board.left}
                  side="L"
                  sel={sel}
                  matched={matched}
                  bad={bad}
                  accent="#5B9DFF"
                  onTap={tapTile}
                />
                <Column
                  tiles={board.right}
                  side="R"
                  sel={sel}
                  matched={matched}
                  bad={bad}
                  accent="#38E1A4"
                  onTap={tapTile}
                />
              </div>
            </div>
          </div>

          <div className="pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 text-center text-[10px] tracking-[2px] text-[#7c8595]">
            {deck.flag} {deck.title} · {t('chain.boards', { n: hud.boards })}
          </div>
        </div>
      )}

      {phase === 'over' && result && (
        <Over result={result} onAgain={start} onHub={() => navigate('/mini-games')} t={t} />
      )}

      <style>{`
        @keyframes chainDraw {
          from { stroke-dashoffset: 1; opacity: .4; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        .chain-line { stroke-dasharray: 1; animation: chainDraw .3s ease-out forwards; }
      `}</style>
    </div>
  );
}

function Column({
  tiles,
  side,
  sel,
  matched,
  bad,
  accent,
  onTap,
}: {
  tiles: Tile[];
  side: 'L' | 'R';
  sel: Sel | null;
  matched: Set<string>;
  bad: string | null;
  accent: string;
  onTap: (side: 'L' | 'R', pairId: string) => void;
}) {
  return (
    <div className="flex flex-col" style={{ gap: GAP, width: '42%' }}>
      {tiles.map((tile) => {
        const isMatched = matched.has(tile.pairId);
        const isSel = sel?.side === side && sel.pairId === tile.pairId;
        const isBad = bad === tile.pairId;
        return (
          <button
            key={tile.pairId}
            onClick={() => onTap(side, tile.pairId)}
            disabled={isMatched}
            className="flex items-center justify-center truncate rounded-2xl border px-2 text-sm font-bold transition-all"
            style={{
              height: TILE_H,
              opacity: isMatched ? 0.3 : 1,
              borderColor: isBad
                ? '#FF5C7A'
                : isSel
                  ? accent
                  : isMatched
                    ? 'rgba(56,225,164,.5)'
                    : '#1c2230',
              background: isBad ? 'rgba(255,92,122,.15)' : isSel ? `${accent}1f` : '#11151d',
              color: isBad ? '#FF5C7A' : isSel ? accent : '#eef1f6',
              boxShadow: isSel ? `0 0 16px ${accent}55` : 'none',
            }}
          >
            {tile.label}
          </button>
        );
      })}
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
        ЦЕПНАЯ<span style={{ color: '#F5B445' }}> СВЯЗЬ</span>
      </h1>
      <p className="mt-2 max-w-xs text-sm text-[#9aa3b2]">{t('chain.how')}</p>

      <div className="mt-5 grid w-full max-w-xs grid-cols-2 gap-2">
        <Metric label={t('chain.due')} value={`${dueNow}`} color="#38E1A4" />
        <Metric label={t('chain.your_level')} value={`${level}`} color="#5B9DFF" />
      </div>

      <div className="mt-5 w-full max-w-xs">
        <div className="mb-2 text-left text-[10px] tracking-[2px] text-[#7c8595]">
          {t('chain.deck')}
        </div>
        <div className="flex flex-col gap-2">
          {DECKS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDeckId(d.id)}
              className="flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm transition-colors"
              style={{
                borderColor: d.id === deckId ? 'rgba(245,180,69,.6)' : '#1c2230',
                background: d.id === deckId ? 'rgba(245,180,69,.08)' : '#10131b',
                color: d.id === deckId ? '#F5B445' : '#cfd5df',
              }}
            >
              <span>
                {d.flag} {d.title}
              </span>
              <span className="text-[10px] text-[#7c8595]">
                {d.cards.length} {t('chain.words')}
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
            background: 'linear-gradient(180deg,#F5B445,#d99320)',
            boxShadow: '0 8px 24px rgba(245,180,69,.3)',
          }}
        >
          ▶ {t('chain.start')}
        </button>
        <button onClick={onBack} className="mt-3 w-full py-2 text-sm text-[#7c8595]">
          {t('chain.exit')}
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
  return (
    <div className="relative z-10 flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-[calc(env(safe-area-inset-top)+1.5rem)] text-center">
      <DiscoRays />
      <span className="text-[10px] tracking-[3px] text-[#7c8595]">{t('chain.game_over')}</span>
      <div className="mt-2 text-6xl font-bold tabular-nums" style={{ color: '#F5B445' }}>
        {result.matched}
      </div>
      <span className="mt-1 text-xs tracking-[2px] text-[#7c8595]">{t('chain.matched')}</span>

      <div className="mt-6 grid w-full max-w-xs grid-cols-3 gap-2">
        <Metric label={t('chain.boards_done')} value={`${result.boards}`} color="#5B9DFF" />
        <Metric label={t('chain.best_combo')} value={`×${result.bestCombo}`} color="#F5B445" />
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

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={onAgain}
          className="press flex items-center justify-center gap-2 rounded-2xl py-4 font-bold text-black"
          style={{ background: 'linear-gradient(180deg,#F5B445,#d99320)' }}
        >
          <RotateCcw size={18} /> {t('chain.again')}
        </button>
        <button
          onClick={onHub}
          className="flex items-center justify-center gap-2 rounded-2xl border py-3.5 font-semibold"
          style={{ borderColor: '#1c2230', color: '#cfd5df' }}
        >
          <Home size={18} /> {t('chain.to_hub')}
        </button>
      </div>
    </div>
  );
}
