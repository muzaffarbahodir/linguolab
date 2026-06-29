/**
 * Звуки мини-игр. Основной источник — реальные SFX, вырезанные из референс-видео
 * (короткие блипы/тики), лежат в /public/sounds/*.mp3 и грузятся в WebAudio-буферы.
 * Если файл не загрузился/не декодировался — откатываемся на синтез-блип, чтобы
 * звук был всегда. Громкость низкая. Мьют хранится в localStorage.
 *
 * Мобильные требуют жест пользователя — поэтому `initAudio()` зовём на тапе «Играть»
 * (он же запускает дозагрузку буферов).
 */
const KEY = 'lg_sound';

type SfxName = 'tap' | 'correct' | 'wrong' | 'win';
type ACtor = typeof AudioContext;

let ctx: AudioContext | null = null;
const buffers: Partial<Record<SfxName, AudioBuffer>> = {};
let loadStarted = false;

function getACtor(): ACtor | null {
  const w = window as unknown as { AudioContext?: ACtor; webkitAudioContext?: ACtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function ensureCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = getACtor();
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '0';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? '0' : '1');
  } catch {
    /* ignore */
  }
}

function loadBuffers(c: AudioContext): void {
  if (loadStarted) return;
  loadStarted = true;
  const base = import.meta.env.BASE_URL || '/';
  const names: SfxName[] = ['tap', 'correct', 'wrong', 'win'];
  for (const name of names) {
    fetch(`${base}sounds/${name}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('404'))))
      .then((buf) => c.decodeAudioData(buf))
      .then((decoded) => {
        buffers[name] = decoded;
      })
      .catch(() => {
        /* нет файла/декодера — останется синтез-фолбэк */
      });
  }
}

/** Создать/возобновить контекст + начать дозагрузку буферов. Звать на жесте. */
export function initAudio(): void {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  loadBuffers(c);
}

function voice(): AudioContext | null {
  if (isMuted()) return null;
  const c = ensureCtx();
  if (!c) return null;
  if (c.state === 'suspended') void c.resume();
  if (!loadStarted) loadBuffers(c);
  return c;
}

// ─── синтез-фолбэк ──────────────────────────────────────────────────────────
interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  at?: number;
  slideTo?: number;
}
function tone(c: AudioContext, o: ToneOpts): void {
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.slideTo), t0 + o.dur);
  const peak = o.gain ?? 0.12;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
}
const synth: Record<SfxName, (c: AudioContext) => void> = {
  tap: (c) => tone(c, { freq: 330, dur: 0.05, type: 'triangle', gain: 0.05 }),
  correct: (c) => {
    tone(c, { freq: 523, dur: 0.09, type: 'sine', gain: 0.1 });
    tone(c, { freq: 784, dur: 0.12, type: 'sine', gain: 0.1, at: 0.075 });
  },
  wrong: (c) => tone(c, { freq: 200, dur: 0.22, type: 'sawtooth', gain: 0.08, slideTo: 110 }),
  win: (c) =>
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(c, { freq: f, dur: 0.14, type: 'triangle', gain: 0.09, at: i * 0.085 }),
    ),
};

function play(name: SfxName, gain = 0.9): void {
  const c = voice();
  if (!c) return;
  const buf = buffers[name];
  if (buf) {
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = gain;
    src.buffer = buf;
    src.connect(g).connect(c.destination);
    src.start();
  } else {
    synth[name](c);
  }
}

export const sfx = {
  tap: () => play('tap', 0.6),
  correct: () => play('correct', 0.9),
  wrong: () => play('wrong', 0.9),
  win: () => play('win', 0.9),
  combo: () => play('tap', 0.4),
};
