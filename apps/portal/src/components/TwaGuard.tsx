'use client';

/**
 * TwaGuard — wraps the app content and shows:
 *
 * 1. Loading spinner   — while AuthProvider is initializing
 * 2. Error screen      — if initData missing (opened outside Telegram)
 * 3. Pending screen    — user exists but is_active === false (awaiting manager)
 * 4. children          — normal app for active users
 *
 * Place inside Providers, wrapping the main content in layout.tsx.
 */

import { useAuth } from './AuthProvider';

export function TwaGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useAuth();

  /* ── Loading ─────────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--glass-bg, #f0f4f8)' }}
      >
        <div className="glass-card rounded-3xl px-10 py-12 text-center">
          <p className="mb-3 text-4xl">🌐</p>
          <p className="text-base font-semibold" style={{ color: 'var(--glass-text, #1a1a2e)' }}>
            LinguoLab
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint, #6b7280)' }}>
            Инициализация…
          </p>
        </div>
      </div>
    );
  }

  /* ── Error (not in Telegram) ─────────────────────────────────────────────── */
  if (error) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: 'var(--glass-bg, #f0f4f8)' }}
      >
        <div className="glass-card rounded-3xl px-8 py-10 text-center">
          <p className="mb-3 text-4xl">🔗</p>
          <p className="text-base font-semibold" style={{ color: 'var(--glass-text, #1a1a2e)' }}>
            Откройте приложение в Telegram
          </p>
          <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint, #6b7280)' }}>
            LinguoLab работает только через Telegram Web App.
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--glass-hint, #6b7280)' }}>
            Перейдите в бот @LinguoLabBot и нажмите «Открыть LinguoLab»
          </p>
        </div>
      </div>
    );
  }

  /* ── Pending activation ──────────────────────────────────────────────────── */
  if (user && !user.is_active) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: 'var(--glass-bg, #f0f4f8)' }}
      >
        <div className="glass-card rounded-3xl px-8 py-10 text-center">
          <p className="mb-3 text-4xl">⏳</p>
          <p className="mb-1 text-lg font-bold" style={{ color: 'var(--glass-text, #1a1a2e)' }}>
            Заявка принята!
          </p>
          <p className="mb-3 text-sm font-medium" style={{ color: 'var(--glass-text, #1a1a2e)' }}>
            Привет, {user.first_name}! 👋
          </p>
          <p className="text-sm" style={{ color: 'var(--glass-hint, #6b7280)' }}>
            Ваша заявка отправлена на рассмотрение.
            <br />
            Менеджер активирует вас в ближайшее время.
          </p>
          <div
            className="mt-6 rounded-2xl px-4 py-3"
            style={{ background: 'var(--glass-green-bg, rgba(16,185,129,0.1))' }}
          >
            <p className="text-xs font-medium" style={{ color: 'var(--glass-accent, #10b981)' }}>
              🔔 Вы получите уведомление в Telegram когда аккаунт будет активирован
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ── Active user — render app ────────────────────────────────────────────── */
  return <>{children}</>;
}
