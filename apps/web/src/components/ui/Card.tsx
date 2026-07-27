import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  /** Карточка реагирует на нажатие: курсор, отклик, ховер. */
  interactive?: boolean;
  children?: ReactNode;
}

/**
 * Card — базовая поверхность.
 *
 * Заменяет 40 разных комбинаций классов, которыми карточки были написаны по
 * всему приложению: только эталонная встречалась 15 раз, остальные — по одному
 * разу каждая. Отсюда и расхождения в радиусах и отступах между экранами.
 *
 * Поверхность плотная, а не стеклянная. Backdrop-blur на тёмном фоне даёт
 * мутный низкоконтрастный результат и читается как устаревший приём; плотный
 * фон с тонкой границей и мягкой тенью выглядит спокойнее и чётче.
 */
export function Card({
  padding = 'md',
  interactive = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(
        'border-hairline bg-surface rounded-2xl border',
        'shadow-[0_1px_2px_rgba(0,0,0,0.24)]',
        PADDING[padding],
        interactive && 'press hover:bg-surface-2 cursor-pointer transition-colors',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
