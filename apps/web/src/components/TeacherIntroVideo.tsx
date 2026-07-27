import { useRef, useState } from 'react';
import { Play } from 'lucide-react';

import { cx } from './ui';

/**
 * Видео-визитка преподавателя.
 *
 * Единственное место в профиле, где студент слышит речь и видит манеру
 * говорить, — по этому и выбирают преподавателя языка. Поэтому блок стоит
 * первым, до текста и звёзд.
 *
 * Автовоспроизведения нет намеренно: профиль часто открывают из транспорта,
 * а заголосивший сам по себе телефон закрывают вместе со страницей.
 */
export function TeacherIntroVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string | null;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  const play = () => {
    setStarted(true);
    void videoRef.current?.play();
  };

  return (
    <div
      className={cx(
        'border-hairline bg-surface-2 relative overflow-hidden rounded-2xl border',
        className,
      )}
      style={{ aspectRatio: '16 / 9' }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        controls={started}
        playsInline
        // metadata вместо auto: профиль открывают и ради расписания, качать
        // ролик целиком каждому заглянувшему незачем.
        preload="metadata"
        onError={() => setFailed(true)}
        className="h-full w-full bg-black object-cover"
      />

      {!started && (
        <button
          type="button"
          onClick={play}
          aria-label="Смотреть видео о преподавателе"
          className="press absolute inset-0 flex items-center justify-center bg-black/25"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg">
            {/* Треугольник визуально смещён влево от центра круга — сдвигаем. */}
            <Play size={24} className="ml-0.5 text-black" fill="currentColor" />
          </span>
        </button>
      )}
    </div>
  );
}
