'use client';

/**
 * /login is no longer used — authentication happens automatically via Telegram WebApp.
 * This page is kept as a fallback in case someone navigates here directly.
 * It shows a friendly message and redirects to root.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: 'var(--glass-bg)' }}
    >
      <div className="glass-card rounded-3xl px-8 py-10 text-center">
        <p className="mb-3 text-3xl">🔗</p>
        <p className="text-base font-semibold" style={{ color: 'var(--glass-text)' }}>
          Откройте приложение через Telegram
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
          Перенаправление...
        </p>
      </div>
    </div>
  );
}
