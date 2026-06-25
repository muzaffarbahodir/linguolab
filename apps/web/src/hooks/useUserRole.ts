/**
 * useUserRole — хук для получения текущей роли пользователя.
 *
 * Используется в App.tsx для <RoleSwitch> (навигация зависит от роли).
 * Этап 2: возвращает роль. Переключатель навигации — Этап 12.7.
 */

import { useAuthStore, type Role } from '../store/auth';

export function useUserRole(): Role | null {
  const user = useAuthStore((s) => s.user);
  return user?.role ?? null;
}
