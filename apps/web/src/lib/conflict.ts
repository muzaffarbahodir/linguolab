import axios from 'axios';

/**
 * Ошибки конфликтов расписания/кабинета с бэка приходят как
 * `SCHEDULE_CONFLICT: «Группа»` / `ROOM_CONFLICT: кабинет занят группой «Группа»`.
 * Возвращает тип конфликта и название группы (если удалось выделить), иначе null.
 */
export function extractConflict(
  err: unknown,
): { kind: 'schedule' | 'room'; title: string | null } | null {
  if (!axios.isAxiosError(err)) return null;
  const msg = String((err.response?.data as { message?: string } | undefined)?.message ?? '');
  const kind = msg.startsWith('SCHEDULE_CONFLICT')
    ? ('schedule' as const)
    : msg.startsWith('ROOM_CONFLICT')
      ? ('room' as const)
      : null;
  if (!kind) return null;
  const m = msg.match(/«(.+?)»/);
  return { kind, title: m?.[1] ?? null };
}
