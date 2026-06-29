/** Кросс-девайс прогресс мини-игр через бэкенд (надёжнее CloudStorage). */
import { apiClient } from './client';

export async function fetchGameProgress(): Promise<unknown> {
  const res = await apiClient.get<{ data: unknown }>('/users/me/game-progress');
  return res.data?.data ?? null;
}

export async function putGameProgress(data: unknown): Promise<void> {
  await apiClient.put('/users/me/game-progress', { data });
}
