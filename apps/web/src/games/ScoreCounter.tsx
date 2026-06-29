/**
 * ScoreCounter — счёт с анимацией накопления: число «прокручивается» к новому
 * значению, всплывает «+N», и играет восходящий перезвон (sfx.score). Заменяет
 * статичный вывод очков в HUD мини-игр.
 */
import { useEffect, useRef, useState } from 'react';
import { sfx } from './sound';

export function ScoreCounter({
  value,
  className,
  color,
}: {
  value: number;
  className?: string;
  color?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [pops, setPops] = useState<{ id: number; delta: number }[]>([]);
  const prevRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const keyRef = useRef(0);

  useEffect(() => {
    const prev = prevRef.current;
    if (value === prev) return;
    const delta = value - prev;
    prevRef.current = value;

    if (delta > 0) {
      const id = keyRef.current++;
      setPops((p) => [...p, { id, delta }]);
      window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 900);
      sfx.score();
    }

    const from = display;
    const start = performance.now();
    const dur = 480;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(step);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return (
    <span className="relative inline-block">
      <span className={className} style={{ color }}>
        {display}
      </span>
      {pops.map((p) => (
        <span
          key={p.id}
          className="score-pop pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 text-xs font-bold"
          style={{ color: color ?? '#38E1A4' }}
        >
          +{p.delta}
        </span>
      ))}
    </span>
  );
}
