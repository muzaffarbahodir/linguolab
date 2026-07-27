import type { ReactNode } from 'react';

import { cx } from './cx';

export interface SectionHeaderProps {
  title: ReactNode;
  /** Пояснение под заголовком — коротко, одной строкой. */
  hint?: ReactNode;
  /** Ссылка или кнопка справа: «Все», «Добавить». */
  action?: ReactNode;
  className?: string;
}

/**
 * SectionHeader — заголовок блока на экране.
 *
 * Заголовки писались вручную семью разными размерами текста; на одном экране
 * секция могла быть `text-sm`, на соседнем `text-lg`, из-за чего иерархия
 * читалась по-разному на каждой вкладке. Здесь размер один, а различает
 * секции содержание, а не кегль.
 */
export function SectionHeader({ title, hint, action, className }: SectionHeaderProps) {
  return (
    <div className={cx('mb-2 flex items-end justify-between gap-3 px-1', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-[color:var(--text)]">{title}</h2>
        {hint && <p className="text-muted mt-0.5 truncate text-xs">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
