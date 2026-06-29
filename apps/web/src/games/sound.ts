/**
 * Звуки мини-игр — синтез через WebAudio (без файлов-ассетов). Короткие блипы:
 * тап, верно, неверно, победа, комбо. Громкость низкая, тон приятный.
 *
 * Мобильные браузеры требуют жест пользователя для старта аудио — поэтому
 * `initAudio()` зовём на тапе «Играть». Мьют хранится в localStorage.
 */
const KEY = 'lg_sound';

type ACtor = typeof AudioContext;
let ctx: AudioContext | null = null;

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

/** Создать/возобновить аудио-контекст. Звать на жесте пользователя (тап). */
export function initAudio(): void {
  const c = ensureCtx();
  if (c && c.state === 'suspended') void c.resume();
}

/** Контекст для воспроизведения — null если выключено или недоступно. */
function voice(): AudioContext | null {
  if (isMuted()) return null;
  const c = ensureCtx();
  if (!c) return null;
  if (c.state === 'suspended') void c.resume();
  return c;
}

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

export const sfx = {
  tap(): void {
    const c = voice();
    if (c) tone(c, { freq: 330, dur: 0.05, type: 'triangle', gain: 0.05 });
  },
  correct(): void {
    const c = voice();
    if (!c) return;
    tone(c, { freq: 523, dur: 0.09, type: 'sine', gain: 0.1 });
    tone(c, { freq: 784, dur: 0.12, type: 'sine', gain: 0.1, at: 0.075 });
  },
  wrong(): void {
    const c = voice();
    if (c) tone(c, { freq: 200, dur: 0.22, type: 'sawtooth', gain: 0.08, slideTo: 110 });
  },
  win(): void {
    const c = voice();
    if (!c) return;
    [523, 659, 784, 1047].forEach((f, i) =>
      tone(c, { freq: f, dur: 0.14, type: 'triangle', gain: 0.09, at: i * 0.085 }),
    );
  },
  combo(): void {
    const c = voice();
    if (c) tone(c, { freq: 680, dur: 0.06, type: 'square', gain: 0.045 });
  },
};
