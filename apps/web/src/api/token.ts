/**
 * tokenHolder — хранит access token вне Zustand чтобы разорвать circular dependency.
 *
 * Проблема: api/client.ts импортирует store для чтения токена,
 * store/auth.ts импортирует apiClient для /auth/telegram/init.
 * Circular import в ESM работает но лучше избежать.
 *
 * Решение: tokenHolder — простой мутабельный синглтон.
 * - auth.store.ts пишет токен сюда при login
 * - api/client.ts читает токен отсюда в request interceptor
 */

let _accessToken: string | null = null;

export const tokenHolder = {
  get(): string | null {
    return _accessToken;
  },
  set(token: string | null): void {
    _accessToken = token;
  },
  clear(): void {
    _accessToken = null;
  },
};
