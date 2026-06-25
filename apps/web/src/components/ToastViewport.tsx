/**
 * ToastViewport — рендерит стек toast'ов поверх всего. Монтируется один раз
 * в App. Стиль — в духе приложения (glass, тёмный, бренд-акценты).
 */
import { useToastStore, type ToastType } from '../store/toast';

const TYPE_STYLE: Record<ToastType, { border: string; icon: string; accent: string }> = {
  success: { border: 'rgba(16,185,129,0.4)', icon: '✅', accent: '#10B981' },
  error: { border: 'rgba(239,68,68,0.4)', icon: '⚠️', accent: '#EF4444' },
  info: { border: 'rgba(108,92,231,0.4)', icon: 'ℹ️', accent: '#8B5CF6' },
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}
    >
      {toasts.map((t) => {
        const s = TYPE_STYLE[t.type];
        return (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className="glass-card pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-left"
            style={{ border: `1px solid ${s.border}`, animation: 'glass-fade-in 0.25s ease' }}
          >
            <span className="text-lg leading-none" style={{ marginTop: 1 }}>
              {s.icon}
            </span>
            <span className="flex-1 text-sm font-medium leading-snug" style={{ color: '#fff' }}>
              {t.message}
            </span>
            <span
              className="text-xs leading-none"
              style={{ color: s.accent, marginTop: 2, opacity: 0.7 }}
            >
              ✕
            </span>
          </button>
        );
      })}
    </div>
  );
}
