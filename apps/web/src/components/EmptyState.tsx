/**
 * EmptyState — единый премиум пустой/ошибочный экран.
 * Emoji-в-круге + заголовок + подпись + опц. CTA. Заменяет голые <p>.
 */
interface Props {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ emoji, title, subtitle, action, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center gap-3 py-14 text-center ${className}`}>
      <div className="bg-brand/10 flex h-20 w-20 items-center justify-center rounded-full text-4xl">
        {emoji}
      </div>
      <div>
        <p className="text-title">{title}</p>
        {subtitle && <p className="text-muted mx-auto mt-1 max-w-xs text-sm">{subtitle}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="glass-btn press mt-1 rounded-xl px-5 py-2.5 text-sm font-semibold"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
