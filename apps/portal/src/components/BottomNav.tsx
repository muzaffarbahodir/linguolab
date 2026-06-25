'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// ── App-icon style tab icons (rounded square bg + white symbol) ───────────

function AppIcon({
  active,
  bg,
  children,
}: {
  active: boolean;
  bg: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      style={{
        filter: active ? 'brightness(1.15)' : 'brightness(0.85)',
        transition: 'filter 0.2s',
      }}
    >
      <rect x="0" y="0" width="30" height="30" rx="8" fill={bg} />
      {children}
    </svg>
  );
}

function IconHome({ active }: { active: boolean }) {
  return (
    <AppIcon active={active} bg="#10B981">
      {/* house */}
      <path d="M15 7 L24 14.5 V23 H19 V18 H11 V23 H6 V14.5 Z" fill="rgba(255,255,255,0.90)" />
      <path d="M11 23 V18 H19 V23" fill="rgba(255,255,255,0.70)" />
    </AppIcon>
  );
}

function IconCourses({ active }: { active: boolean }) {
  return (
    <AppIcon active={active} bg="#3B82F6">
      {/* open book */}
      <path d="M15 22V10" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 10 Q8 8 10 8 L15 10 L15 22 L10 21 Q8 21 8 19 Z" fill="rgba(255,255,255,0.90)" />
      <path
        d="M22 10 Q22 8 20 8 L15 10 L15 22 L20 21 Q22 21 22 19 Z"
        fill="rgba(255,255,255,0.65)"
      />
    </AppIcon>
  );
}

function IconLessons({ active }: { active: boolean }) {
  return (
    <AppIcon active={active} bg="#8B5CF6">
      {/* calendar */}
      <rect x="7" y="9" width="16" height="14" rx="2.5" fill="rgba(255,255,255,0.88)" />
      <path d="M7 13 H23" stroke="rgba(139,92,246,0.55)" strokeWidth="1.3" />
      <path d="M11 7 V11 M19 7 V11" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11" cy="17" r="1.2" fill="rgba(139,92,246,0.8)" />
      <circle cx="15" cy="17" r="1.2" fill="rgba(139,92,246,0.8)" />
      <circle cx="19" cy="17" r="1.2" fill="rgba(139,92,246,0.8)" />
    </AppIcon>
  );
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <AppIcon active={active} bg="#EC4899">
      {/* person */}
      <circle cx="15" cy="11.5" r="3.8" fill="white" opacity="0.92" />
      <path d="M8 23 Q8 17 15 17 Q22 17 22 23" fill="white" opacity="0.80" />
    </AppIcon>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────

const TABS = [
  { href: '/', label: 'Главная', Icon: IconHome },
  { href: '/courses', label: 'Курсы', Icon: IconCourses },
  { href: '/my/lessons', label: 'Уроки', Icon: IconLessons },
  { href: '/profile', label: 'Профиль', Icon: IconProfile },
];

// ── BottomNav ─────────────────────────────────────────────────────────────

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith('/teacher') || pathname.startsWith('/login')) {
    return null;
  }

  return (
    <div
      className="pb-safe fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: `max(env(safe-area-inset-bottom), 10px)` }}
    >
      <nav
        className="glass-pill mx-4 flex w-full items-center rounded-[40px]"
        style={{ maxWidth: 420 }}
      >
        {TABS.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-1 flex-col items-center justify-center py-3 active:opacity-60"
              style={{ transition: 'opacity 0.2s' }}
            >
              <span
                style={{
                  padding: '3px 6px',
                  transform: active ? 'scale(1.12)' : 'scale(1)',
                  transition: 'transform 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <tab.Icon active={active} />
              </span>
              <span
                className="mt-1.5 text-[10px] font-semibold leading-none tracking-wide"
                style={{
                  color: active ? 'var(--glass-accent, #10b981)' : 'var(--glass-hint, #6ee7b7)',
                  opacity: active ? 1 : 0.6,
                }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
