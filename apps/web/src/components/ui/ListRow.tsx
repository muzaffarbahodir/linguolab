import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from './cx';

export interface ListRowProps {
  /** Иконка или аватар слева. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Значение, бейдж или кнопка справа. */
  trailing?: ReactNode;
  onClick?: () => void;
  /** Показать шеврон. По умолчанию — когда строка кликабельна. */
  chevron?: boolean;
  className?: string;
}

/**
 * ListRow — строка списка: иконка, заголовок, подпись, значение справа.
 *
 * Самый частый элемент приложения и одновременно самый разнобойный: строки
 * писались как `flex items-center gap-3` с разными отступами и размерами
 * текста на каждом экране, отчего списки на соседних вкладках выглядели как из
 * разных приложений.
 *
 * Кликабельная строка рендерится кнопкой, а не div с onClick: так она попадает
 * в обход с клавиатуры и озвучивается скринридером.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  chevron,
  className,
}: ListRowProps) {
  const clickable = Boolean(onClick);
  const showChevron = chevron ?? clickable;

  const content = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}

      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium text-[color:var(--text)]">{title}</span>
        {subtitle && <span className="text-muted mt-0.5 block truncate text-xs">{subtitle}</span>}
      </span>

      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {showChevron && <ChevronRight size={16} className="text-faint shrink-0" aria-hidden />}
    </>
  );

  const classes = cx(
    'flex w-full items-center gap-3 px-4 py-3',
    clickable && 'press transition-colors hover:bg-surface-2',
    className,
  );

  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}

/**
 * Группа строк одной карточкой с разделителями.
 * Разделители через :not(:last-child), чтобы не тянуть их в каждую строку и не
 * получить лишнюю линию внизу списка.
 */
export function ListGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'border-hairline bg-surface overflow-hidden rounded-2xl border',
        'shadow-[0_1px_2px_rgba(0,0,0,0.24)]',
        '[&>*:not(:last-child)]:border-hairline [&>*:not(:last-child)]:border-b',
        className,
      )}
    >
      {children}
    </div>
  );
}
