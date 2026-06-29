/** Кнопка вкл/выкл звука для мини-игр. Абсолютный угол поверх игры. */
import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isMuted, setMuted, initAudio, sfx } from './sound';

export function SoundToggle({ className }: { className?: string }) {
  const [muted, setM] = useState(isMuted());
  return (
    <button
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setM(next);
        if (!next) {
          initAudio();
          sfx.tap();
        }
      }}
      aria-label="sound"
      className={`absolute right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-20 flex h-9 w-9 items-center justify-center rounded-full border ${className ?? ''}`}
      style={{ borderColor: '#1c2230', background: '#10131b', color: '#7c8595' }}
    >
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  );
}
