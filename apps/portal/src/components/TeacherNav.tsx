'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { ThemeToggle } from './ThemeProvider';

const LINKS = [
  { href: '/teacher', label: 'Дашборд', exact: true },
  { href: '/teacher/schedule', label: 'Расписание', exact: false },
];

export default function TeacherNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex justify-center px-4 pb-2 pt-4">
      <div className="glass-emerald flex w-full max-w-lg flex-col gap-2 rounded-2xl px-4 py-3">
        {/* Top row — logo + controls */}
        <div className="flex items-center justify-between">
          <Link href="/teacher" className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold text-white"
              style={{ background: 'var(--glass-accent)' }}
            >
              L
            </span>
            <span
              className="text-sm font-bold tracking-tight"
              style={{ color: 'var(--glass-text)' }}
            >
              LinguoLab
            </span>
            <span className="glass-option-emerald rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest">
              Учитель
            </span>
          </Link>

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

        {/* Bottom row — tab links */}
        <div className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-xl px-3 py-1 text-xs font-semibold transition-all active:scale-95"
                style={{
                  background: active
                    ? 'var(--glass-green-bg, rgba(16,185,129,0.15))'
                    : 'transparent',
                  color: active ? 'var(--glass-accent)' : 'var(--glass-hint)',
                  border: active
                    ? '1px solid var(--glass-green-border, rgba(16,185,129,0.25))'
                    : '1px solid transparent',
                }}
              >
                {l.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
