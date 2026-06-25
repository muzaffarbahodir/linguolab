'use client';

import Link from 'next/link';
import { useAuth } from './AuthProvider';
import { ThemeToggle } from './ThemeProvider';

export default function Nav({ title }: { title?: string }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex justify-center px-4 pb-2 pt-4">
      <div className="glass flex w-full max-w-lg items-center justify-between rounded-2xl px-4 py-3">
        {/* Left — logo or page title */}
        <Link href="/" className="flex items-center gap-2" style={{ color: 'var(--glass-text)' }}>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold text-white"
            style={{ background: 'var(--glass-accent)' }}
          >
            L
          </span>
          <span className="text-sm font-bold tracking-tight">{title ?? 'LinguoLab'}</span>
        </Link>

        {/* Right — theme toggle + user name */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          {user && (
            <span
              className="hidden text-xs font-medium sm:block"
              style={{ color: 'var(--glass-hint)' }}
            >
              {user.first_name}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
