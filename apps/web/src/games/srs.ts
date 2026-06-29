/**
 * Лёгкий движок интервального повторения (Leitner) + XP для мини-игр.
 *
 * Это «полезная» начинка под залипательной обёрткой: игра приоритетно
 * подсовывает слова, которые пора повторить, а правильные ответы двигают
 * карточку в следующий «ящик» с большим интервалом. Так слова реально
 * закрепляются, а не просто мелькают.
 *
 * Хранение: localStorage (быстро, без бэкенда). Итоговый XP дополнительно
 * зеркалим в Telegram CloudStorage — чтобы прогресс жил кросс-девайс.
 * Позже легко синхронизировать с сервером для рейтинга.
 */
import WebApp from '@twa-dev/sdk';

const SRS_KEY = 'lg_srs_v1';
const XP_KEY = 'lg_xp_v1';

/** Интервалы ящиков Leitner в миллисекундах (box 0 → повторить почти сразу). */
const BOX_MS = [
  0,
  4 * 60 * 60 * 1000, // 4 часа
  24 * 60 * 60 * 1000, // 1 день
  3 * 24 * 60 * 60 * 1000, // 3 дня
  7 * 24 * 60 * 60 * 1000, // 7 дней
  16 * 24 * 60 * 60 * 1000, // 16 дней
];
const MAX_BOX = BOX_MS.length - 1;

export interface CardState {
  box: number;
  /** Когда карточка снова «созреет» (timestamp ms). */
  due: number;
  reps: number;
  lapses: number;
}

export interface XpState {
  xp: number;
  /** Лучший счёт по каждой игре. */
  best: Record<string, number>;
  /** Сколько всего слов хоть раз отвечено верно (для «выучено N»). */
  learned: number;
  /** XP, заработанный в последней игре — для анимации полосы в хабе. */
  lastGain: number;
}

type SrsMap = Record<string, CardState>;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* TWA может блокировать localStorage — молча игнорируем */
  }
}

// ─── SRS ────────────────────────────────────────────────────────────────────

export function loadSrs(): SrsMap {
  return readJson<SrsMap>(SRS_KEY, {});
}

export function saveSrs(map: SrsMap): void {
  writeJson(SRS_KEY, map);
}

/**
 * Оценить ответ по карточке. Верно → ящик +1 (растёт интервал). Неверно →
 * сброс в ящик 0 + счётчик «срывов». Возвращает обновлённую карту (мутирует копию).
 */
export function gradeCard(map: SrsMap, cardId: string, correct: boolean): SrsMap {
  const now = Date.now();
  const prev = map[cardId] ?? { box: 0, due: now, reps: 0, lapses: 0 };
  let box = prev.box;
  let lapses = prev.lapses;
  if (correct) {
    box = Math.min(prev.box + 1, MAX_BOX);
  } else {
    box = 0;
    lapses += 1;
  }
  const next: CardState = {
    box,
    due: now + BOX_MS[box]!,
    reps: prev.reps + 1,
    lapses,
  };
  return { ...map, [cardId]: next };
}

/**
 * Отсортировать id колоды по приоритету повторения: сперва «просроченные»
 * (due ≤ сейчас, самые старые), затем новые (никогда не показанные), затем
 * остальные по близости due. Перемешиваем внутри групп для разнообразия.
 */
export function prioritize(map: SrsMap, cardIds: string[]): string[] {
  const now = Date.now();
  const due: string[] = [];
  const fresh: string[] = [];
  const later: string[] = [];
  for (const id of cardIds) {
    const st = map[id];
    if (!st) fresh.push(id);
    else if (st.due <= now) due.push(id);
    else later.push(id);
  }
  due.sort((a, b) => map[a]!.due - map[b]!.due);
  later.sort((a, b) => map[a]!.due - map[b]!.due);
  shuffle(fresh);
  return [...due, ...fresh, ...later];
}

export function dueCount(map: SrsMap, cardIds: string[]): number {
  const now = Date.now();
  return cardIds.filter((id) => !map[id] || map[id]!.due <= now).length;
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

// ─── XP ───────────────────────────────────────────────────────────────────

export function loadXp(): XpState {
  return readJson<XpState>(XP_KEY, { xp: 0, best: {}, learned: 0, lastGain: 0 });
}

/** Уровень = floor(sqrt(xp / 50)) + 1. Порог уровня растёт квадратично. */
export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const base = (level - 1) * (level - 1) * 50;
  const next = level * level * 50;
  return { level, into: xp - base, need: next - base };
}

/**
 * Записать результат игры: добавить XP, обновить рекорд и счётчик выученных.
 * Зеркалит итог в CloudStorage. Возвращает новое состояние.
 */
export function commitGameResult(args: {
  gameId: string;
  xpGain: number;
  score: number;
  learnedGain: number;
}): XpState {
  const cur = loadXp();
  const gain = Math.max(0, Math.round(args.xpGain));
  const next: XpState = {
    xp: cur.xp + gain,
    learned: cur.learned + Math.max(0, args.learnedGain),
    best: { ...cur.best, [args.gameId]: Math.max(cur.best[args.gameId] ?? 0, args.score) },
    lastGain: gain,
  };
  writeJson(XP_KEY, next);
  pushCloud();
  return next;
}

/** Сбросить «заработано за последнюю игру» после показа анимации в хабе. */
export function clearLastGain(): void {
  const cur = loadXp();
  if (cur.lastGain) writeJson(XP_KEY, { ...cur, lastGain: 0 });
}

// ─── Кросс-девайс синхронизация (Telegram CloudStorage) ──────────────────────
// localStorage у ПК и телефона разный → прогресс расходился. CloudStorage один
// на все устройства пользователя: пушим итог после игры, тянем и сливаем при
// заходе в хаб. Сливаем по максимуму (не теряем прогресс ни одного устройства).

const SRS_CLOUD_MAX = 3500; // лимит ключа CloudStorage ~4096 символов

function mergeBest(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = Math.max(out[k] ?? 0, b[k] ?? 0);
  return out;
}

function mergeSrs(local: SrsMap, cloud: SrsMap): SrsMap {
  const out: SrsMap = { ...local };
  for (const id of Object.keys(cloud)) {
    const c = cloud[id]!;
    const l = out[id];
    // больше повторений = свежее; при равенстве — более поздний due
    if (!l || c.reps > l.reps || (c.reps === l.reps && c.due > l.due)) out[id] = c;
  }
  return out;
}

/** Записать XP + SRS в CloudStorage (после игры). */
export function pushCloud(): void {
  try {
    const xp = loadXp();
    WebApp.CloudStorage.setItem(
      XP_KEY,
      JSON.stringify({ xp: xp.xp, learned: xp.learned, best: xp.best }),
    );
    const srsStr = JSON.stringify(loadSrs());
    if (srsStr.length <= SRS_CLOUD_MAX) WebApp.CloudStorage.setItem(SRS_KEY, srsStr);
  } catch {
    /* нет CloudStorage вне TWA */
  }
}

/** Подтянуть и слить XP + SRS из CloudStorage. cb с обновлённым XP после слияния. */
export function pullCloud(cb?: (xp: XpState) => void): void {
  try {
    WebApp.CloudStorage.getItems(
      [XP_KEY, SRS_KEY],
      (err: unknown, values?: Record<string, string>) => {
        if (err || !values) return;
        // SRS сначала — чтобы due-счётчик в cb был уже актуальным
        try {
          if (values[SRS_KEY]) {
            const cloud = JSON.parse(values[SRS_KEY]) as SrsMap;
            writeJson(SRS_KEY, mergeSrs(loadSrs(), cloud));
          }
        } catch {
          /* ignore */
        }
        try {
          if (values[XP_KEY]) {
            const cloud = JSON.parse(values[XP_KEY]) as Partial<XpState>;
            const local = loadXp();
            const merged: XpState = {
              xp: Math.max(local.xp, cloud.xp ?? 0),
              learned: Math.max(local.learned, cloud.learned ?? 0),
              best: mergeBest(local.best, cloud.best ?? {}),
              lastGain: local.lastGain,
            };
            writeJson(XP_KEY, merged);
            cb?.(merged);
          }
        } catch {
          /* ignore */
        }
      },
    );
  } catch {
    /* ignore */
  }
}
