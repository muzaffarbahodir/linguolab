'use client';

/**
 * AuthProvider — TWA authentication context.
 *
 * On mount:
 *  1. Reads window.Telegram.WebApp.initData
 *  2. Sends it to POST /api/auth/twa (sets httpOnly cookie + returns user)
 *  3. Provides { user, loading, error } via useAuth() hook
 *
 * If initData is unavailable (dev / desktop browser):
 *  - Sets error state so a friendly message can be shown
 *
 * Pending users (is_active === false):
 *  - user is set but user.is_active === false
 *  - Pages / guards can check this and show the pending screen
 */

import { createContext, startTransition, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  locale: string;
  timezone: string;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<AuthCtx>({ user: null, loading: true, error: null });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Expand to full screen in Telegram
      window.Telegram?.WebApp?.ready();
      window.Telegram?.WebApp?.expand();

      const initData = window.Telegram?.WebApp?.initData;

      if (!initData) {
        if (!cancelled) {
          startTransition(() => {
            setError('Откройте приложение через Telegram');
            setLoading(false);
          });
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/twa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message ?? `Auth failed (${res.status})`);
        }

        const data = (await res.json()) as { user: AuthUser };

        if (!cancelled) {
          startTransition(() => {
            setUser(data.user);
            setLoading(false);
          });
        }
      } catch (e) {
        if (!cancelled) {
          startTransition(() => {
            setError(e instanceof Error ? e.message : 'Ошибка авторизации');
            setLoading(false);
          });
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  return <Ctx.Provider value={{ user, loading, error }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(Ctx);
}
