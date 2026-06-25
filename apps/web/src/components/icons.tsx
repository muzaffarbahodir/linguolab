/**
 * SVG-иконки для BottomNav.
 * 24x24, currentColor — наследуется от родителя через text-* tailwind-классы.
 * Heroicons-style outline.
 */

type IconProps = {
  className?: string;
};

const baseProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10a1 1 0 0 0 1 1h3v-7h6v7h3a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5z" />
      <path d="M4 19a2 2 0 0 1 2-2h12" />
      <path d="M9 7h6" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg {...baseProps} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}
