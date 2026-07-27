import type { ReactNode } from 'react';

import { cx } from './cx';

type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger';

const TONE: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand/15 text-brand-400',
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  danger: 'bg-danger/15 text-danger',
};

export interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}

/**
 * Badge — статус или счётчик.
 *
 * Было 43 варианта на 59 использований: прозрачность фона бренда встречалась
 * шести разных значений (/5, /10, /12, /15, /20 и сплошной), радиус — то
 * `rounded-full`, то `rounded-lg`. Пять тонов покрывают все реальные случаи;
 * если понадобится шестой, его добавляют сюда, а не на странице.
 */
export function Badge({ tone = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
