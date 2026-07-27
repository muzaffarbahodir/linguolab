import type { ReactNode } from 'react';

import { cx } from './cx';

export interface ChoiceCardProps {
  title: string;
  description?: string;
  /** Эмодзи или иллюстрация справа. */
  art?: ReactNode;
  /** Плашка над карточкой: «рекомендуем», «бесплатно», «от 10 лет». */
  ribbon?: string;
  /**
   * Цвет категории. Задаётся ОДИН раз на смысл и дальше не меняется: цвет тут
   * работает опознавательным знаком, а не украшением. Без карты соответствий
   * получается то, от чего экраны выглядят пёстрыми — разный оттенок на каждом
   * элементе.
   */
  tint?: string;
  onClick: () => void;
  className?: string;
}

/**
 * ChoiceCard — крупная карточка выбора в мастере подбора.
 *
 * Заменяет строку с иконкой 22px: выбор — главное действие на экране, и он
 * должен занимать место, а не прятаться в списке. Заголовок читается с
 * расстояния, описание объясняет, что стоит за вариантом, — человек выбирает
 * осознанно, а не тыкает наугад.
 */
export function ChoiceCard({
  title,
  description,
  art,
  ribbon,
  tint,
  onClick,
  className,
}: ChoiceCardProps) {
  return (
    <div className={cx('relative', ribbon && 'pt-3', className)}>
      {ribbon && (
        <span
          className="absolute left-4 top-0 z-10 rounded-full px-3 py-1 text-xs font-bold text-white"
          style={{ background: tint ?? 'rgb(var(--brand-rgb))' }}
        >
          {ribbon}
        </span>
      )}

      <button
        type="button"
        onClick={onClick}
        className={cx(
          'press flex w-full items-center gap-4 rounded-3xl p-5 text-left',
          'border-hairline border transition-colors',
        )}
        style={
          tint
            ? {
                background: `color-mix(in srgb, ${tint} 16%, transparent)`,
                borderColor: `color-mix(in srgb, ${tint} 35%, transparent)`,
              }
            : undefined
        }
      >
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-bold text-[color:var(--text)]">{title}</span>
          {description && (
            <span className="text-muted mt-1.5 block text-sm leading-snug">{description}</span>
          )}
        </span>

        {art && <span className="shrink-0 text-4xl leading-none">{art}</span>}
      </button>
    </div>
  );
}
