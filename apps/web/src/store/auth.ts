/**
 * Auth store — Zustand (in-memory, без persist).
 *
 * ПОЧЕМУ БЕЗ PERSIST:
 *   TWA WebView обнуляет localStorage при закрытии у части устройств.
 *   Telegram не гарантирует сохранность localStorage между сессиями TWA.
 *   initData всегда доступен через WebApp.initData при открытии.
 *   Поэтому: открыл TWA → auto-init → токен в памяти.
 *   Закрыл TWA → состояние сброшено → при следующем открытии → снова init.
 *
 * ACCESS TOKEN хранится В ДВУХ местах:
 *   1. tokenHolder (для axios interceptor — без circular import)
 *   2. useAuthStore.accessToken (для React компонентов через селекторы)
 *
 * REFRESH TOKEN для TWA: НЕ используется.
 *   При 401 → повторный /auth/telegram/init (см. api/client.ts interceptor).
 */

import * as Sentry from '@sentry/react';
import { create } from 'zustand';
import { apiClient } from '../api/client';
import { tokenHolder } from '../api/token';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type Role = 'STUDENT' | 'TEACHER' | 'MANAGER' | 'PARENT' | 'ADMIN' | 'SUPER_ADMIN';

export interface AuthUser {
  id: string;
  telegram_user_id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: Role;
  locale: string;
  timezone: string;
  /** Активирован ли аккаунт (false = новый, ждёт онбординга/подтверждения). */
  is_active?: boolean;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error' | 'not_in_telegram';

export interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  user: AuthUser | null;
  error: string | null;

  /**
   * Временная роль для превью (только для ADMIN/SUPER_ADMIN).
   * null = показываем реальный интерфейс роли.
   * Не влияет на JWT/API — только на UI.
   */
  previewRole: Role | null;

  /** Авторизация через Telegram initData (для TWA) */
  login: (initData: string) => Promise<void>;

  /** Разлогин — сбрасывает состояние */
  logout: () => void;

  /** Статус "запущено вне Telegram" */
  setNotInTelegram: () => void;

  /** Установить роль превью (null = сбросить) */
  setPreviewRole: (role: Role | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  accessToken: null,
  user: null,
  error: null,
  previewRole: null,

  login: async (initData: string) => {
    set({ status: 'loading', error: null });

    try {
      const response = await apiClient.post<{
        access_token: string;
        refresh_token: string;
        user: AuthUser;
      }>('/auth/telegram/init', { initData });

      const { access_token, user } = response.data;

      // Пишем токен в tokenHolder (для axios interceptor)
      tokenHolder.set(access_token);

      Sentry.setUser({
        id: user.id,
        username: user.username ?? undefined,
        data: { role: user.role, tg_id: user.telegram_user_id },
      });

      set({
        status: 'authenticated',
        accessToken: access_token,
        user,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Auth failed';
      tokenHolder.clear();
      set({
        status: 'error',
        accessToken: null,
        user: null,
        error: message,
      });
      throw err; // пробрасываем для main.tsx catch
    }
  },

  logout: () => {
    tokenHolder.clear();
    Sentry.setUser(null);
    set({
      status: 'idle',
      accessToken: null,
      user: null,
      error: null,
    });
  },

  setNotInTelegram: () => {
    set({
      status: 'not_in_telegram',
      accessToken: null,
      user: null,
      error: null,
    });
  },

  setPreviewRole: (role) => {
    set({ previewRole: role });
  },
}));
