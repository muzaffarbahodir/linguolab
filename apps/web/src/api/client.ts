/**
 * Axios клиент для LinguoLab API.
 *
 * Конфигурация:
 * - baseURL берётся из import.meta.env.VITE_API_URL (задаётся в .env.local / .env.production)
 * - credentials: true (для CORS с Authorization header)
 *
 * Интерсепторы:
 * 1. Request: добавляет Authorization: Bearer <access_token> из tokenHolder
 * 2. Response: на 401 — попытка re-init через WebApp.initData
 *    Если повторный init тоже 401 → вызываем onUnauthorized callback (logout)
 *
 * Circular dependency решается через tokenHolder.ts:
 *   client.ts → tokenHolder.ts (без импорта store)
 *   store/auth.ts → client.ts + tokenHolder.ts (пишет токен)
 *
 * TWA refresh стратегия:
 *   Refresh token НЕ используется — при 401 re-init через WebApp.initData.
 *   initData всегда свежий пока TWA открыт (Telegram обновляет при каждом запуске).
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import WebApp from '@twa-dev/sdk';

import { tokenHolder } from './token';

// Расширяем конфиг запроса для флага "_retry"
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/** Создаём axios инстанс */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'https://api-linguolab.muzaffarbahodir.uz/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST INTERCEPTOR — добавляем Authorization header
// ─────────────────────────────────────────────────────────────────────────────

apiClient.interceptors.request.use((config) => {
  const token = tokenHolder.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE INTERCEPTOR — 401 → re-init через WebApp.initData
// ─────────────────────────────────────────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;

    // Если не 401 или уже retry — пробрасываем
    if (error.response?.status !== 401 || !config || config._retry) {
      return Promise.reject(error);
    }

    config._retry = true;

    const initData = WebApp.initData;
    if (!initData) {
      // Вне Telegram — нет смысла делать re-init
      tokenHolder.clear();
      return Promise.reject(error);
    }

    try {
      // Re-init: POST /auth/telegram/init со свежим initData
      const res = await apiClient.post<{ access_token: string; refresh_token: string }>(
        '/auth/telegram/init',
        { initData },
      );

      const newToken = res.data.access_token;
      tokenHolder.set(newToken);

      // Повторяем оригинальный запрос с новым токеном
      config.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(config);
    } catch {
      // Re-init тоже упал → очищаем токен (store.logout вызовет App.tsx через status)
      tokenHolder.clear();
      return Promise.reject(error);
    }
  },
);
