/**
 * DiscoBurst — праздничная вспышка «диско-шара» на повышение уровня: крутящиеся
 * цветные лучи из центра + крупный номер уровня + диско-перезвон (sfx.levelup).
 * Срабатывает, когда проп `level` увеличивается во время игры.
 */
import { useEffect, useRef, useState } from 'react';
import { sfx } from './sound';

export function DiscoBurst({ level, label }: { level: number; label?: string }) {
  const prevRef = useRef(level);
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (level > prevRef.current) {
      prevRef.current = level;
      setShown(level);
      sfx.levelup();
      const id = window.setTimeout(() => setShown(null), 1500);
      return () => window.clearTimeout(id);
    }
    prevRef.current = level;
  }, [level]);

  if (shown == null) return null;

  return (
    <div className="disco-overlay pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden">
      <div className="disco-rays" />
      <div className="disco-core relative text-center">
        <div className="text-[10px] tracking-[3px] text-white/70">{label ?? 'УРОВЕНЬ'}</div>
        <div className="disco-level text-6xl font-bold text-white">{shown}</div>
      </div>
    </div>
  );
}
