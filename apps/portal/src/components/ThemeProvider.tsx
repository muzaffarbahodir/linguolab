'use client';

import { createContext, startTransition, useContext, useEffect, useState } from 'react';
import { type GlassThemeId, applyGlassTheme, getStoredTheme, storeTheme } from '../lib/glass-theme';

interface ThemeCtx {
  theme: GlassThemeId;
  setTheme: (id: GlassThemeId) => void;
}

const Ctx = createContext<ThemeCtx>({ theme: 'nuar', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<GlassThemeId>('nuar');

  // Apply stored theme on mount (runs once client-side)
  useEffect(() => {
    const stored = getStoredTheme();
    applyGlassTheme(stored);
    startTransition(() => setThemeState(stored));
  }, []);

  function setTheme(id: GlassThemeId) {
    setThemeState(id);
    storeTheme(id);
    applyGlassTheme(id);
  }

  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

/* ── Theme toggle button — drop anywhere ─────────────────────────────────── */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'pearl' ? 'nuar' : 'pearl')}
      className={`glass-pill flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-all active:scale-95 ${className}`}
      aria-label="Переключить тему"
    >
      <span className="text-base">{theme === 'pearl' ? '🌙' : '☀️'}</span>
      <span style={{ color: 'var(--glass-hint)' }}>{theme === 'pearl' ? 'Тёмная' : 'Светлая'}</span>
    </button>
  );
}
