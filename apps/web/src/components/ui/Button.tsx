import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-400',
  secondary: 'bg-surface-2 text-[color:var(--text)] hover:bg-surface',
  ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-[color:var(--text)]',
  danger: 'bg-danger/12 text-danger hover:bg-danger/20',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'w-full py-3 text-sm',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Показывает индикатор и блокирует повторное нажатие. */
  loading?: boolean;
  leftIcon?: ReactNode;
  fullWidth?: boolean;
}

/**
 * Button — единственная кнопка приложения.
 *
 * Раньше кнопок было 33 разных написания на 46 использований: отличались
 * `disabled:opacity-50` и `-60`, `py-3` / `py-2.5` / `py-2`, `rounded-xl` и
 * `rounded-2xl` — при одинаковой роли. Глаз замечает такие расхождения между
 * экранами даже когда не может их назвать.
 *
 * loading блокирует кнопку сам: почти везде это писалось руками как
 * `disabled={saving}`, и там, где забывали, форма отправлялась дважды.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  fullWidth = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        'press inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        leftIcon
      )}
      {children}
    </button>
  );
}
