import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';

// ── App-icon style tab icons ──────────────────────────────────────────────

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
      style={{ filter: active ? 'brightness(1.15)' : 'brightness(1)', transition: 'filter 0.2s' }}
    >
      <rect x="0" y="0" width="30" height="30" rx="8" fill={bg} />
      {children}
    </svg>
  );
}

function IconHome({ active }: { active: boolean }) {
  return (
    <AppIcon active={active} bg="#6366f1">
      <path d="M15 7 L24 14.5 V23 H19 V18 H11 V23 H6 V14.5 Z" fill="rgba(255,255,255,0.90)" />
      <path d="M11 23 V18 H19 V23" fill="rgba(255,255,255,0.65)" />
    </AppIcon>
  );
}

function IconSchedule({ active }: { active: boolean }) {
  return (
    <AppIcon active={active} bg="#3B82F6">
      <rect x="7" y="9" width="16" height="14" rx="2.5" fill="rgba(255,255,255,0.88)" />
      <path d="M7 13 H23" stroke="rgba(59,130,246,0.55)" strokeWidth="1.3" />
      <path d="M11 7 V11 M19 7 V11" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="11" cy="17" r="1.2" fill="rgba(59,130,246,0.8)" />
      <circle cx="15" cy="17" r="1.2" fill="rgba(59,130,246,0.8)" />
      <circle cx="19" cy="17" r="1.2" fill="rgba(59,130,246,0.8)" />
    </AppIcon>
  );
}

function IconCourses({ active }: { active: boolean }) {
  return (
    <AppIcon active={active} bg="#10B981">
      <path d="M15 22V10" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 10 Q8 8 10 8 L15 10 L15 22 L10 21 Q8 21 8 19 Z" fill="rgba(255,255,255,0.90)" />
      <path
        d="M22 10 Q22 8 20 8 L15 10 L15 22 L20 21 Q22 21 22 19 Z"
        fill="rgba(255,255,255,0.65)"
      />
    </AppIcon>
  );
}

function IconProfile({ active }: { active: boolean }) {
  return (
    <AppIcon active={active} bg="#EC4899">
      <circle cx="15" cy="11.5" r="3.8" fill="white" opacity="0.92" />
      <path d="M8 23 Q8 17 15 17 Q22 17 22 23" fill="white" opacity="0.80" />
    </AppIcon>
  );
}

function IconTeacher({ active }: { active: boolean }) {
  return (
    <AppIcon active={active} bg="#F59E0B">
      <rect x="8" y="8" width="14" height="11" rx="2" fill="rgba(255,255,255,0.88)" />
      <path d="M11 22 L15 19 L19 22" fill="rgba(255,255,255,0.70)" />
      <path
        d="M11 13 H19 M11 16 H16"
        stroke="rgba(245,158,11,0.7)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </AppIcon>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function BottomNav({ previewRole }: { previewRole?: string }) {
  const { t } = useTranslation();
  const realRole = useAuthStore((s) => s.user?.role);

  // Use previewRole for nav display when admin is previewing
  const role = previewRole ?? realRole;

  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'MANAGER';
  const isTeacher = role === 'TEACHER';

  const studentItems = [
    { to: '/', label: t('nav.home'), Icon: IconHome },
    { to: '/schedule', label: t('nav.schedule'), Icon: IconSchedule },
    { to: '/courses', label: t('nav.courses'), Icon: IconCourses },
    { to: '/profile', label: t('nav.profile'), Icon: IconProfile },
  ];

  const teacherItems = [
    { to: '/teacher', label: t('nav.classes'), Icon: IconTeacher },
    { to: '/schedule', label: t('nav.schedule'), Icon: IconSchedule },
    { to: '/profile', label: t('nav.profile'), Icon: IconProfile },
  ];

  // Admin: only Profile tab — admin panel accessible via banner inside profile.
  const adminItems = [{ to: '/profile', label: t('nav.profile'), Icon: IconProfile }];

  const items = isAdmin ? adminItems : isTeacher ? teacherItems : studentItems;

  return (
    <nav
      className="safe-bottom fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}
    >
      <div
        className="glass-pill mx-4 flex w-full items-center rounded-[40px]"
        style={{ maxWidth: 420 }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="press flex flex-1 flex-col items-center justify-center py-3"
          >
            {({ isActive }) => (
              <>
                <span className="relative flex" style={{ padding: '3px 6px' }}>
                  {/* Soft brand glow under active icon */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(99,102,241,0.55) 0%, transparent 70%)',
                      filter: 'blur(9px)',
                      transform: 'scale(1.5)',
                      opacity: isActive ? 1 : 0,
                      transition: 'opacity 0.25s ease',
                    }}
                  />
                  <span
                    className="relative flex"
                    style={{
                      transform: isActive ? 'scale(1.12)' : 'scale(1)',
                      transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                  >
                    <item.Icon active={isActive} />
                  </span>
                </span>
                <span
                  className="mt-1.5 text-[10px] font-semibold leading-none tracking-wide"
                  style={{
                    color: isActive
                      ? 'var(--tg-theme-button-color, #6366f1)'
                      : 'var(--tg-theme-hint-color, #8E8E93)',
                    opacity: isActive ? 1 : 0.7,
                    transform: isActive ? 'translateY(0)' : 'translateY(1px)',
                    transition: 'opacity 0.25s ease, transform 0.25s ease, color 0.25s ease',
                  }}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
