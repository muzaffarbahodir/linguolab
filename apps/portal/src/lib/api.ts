/**
 * Хелпер для вызовов API из Server Components / Route Handlers.
 * Добавляет Authorization header из сессии.
 */
const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

export async function apiFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${API_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });
}
