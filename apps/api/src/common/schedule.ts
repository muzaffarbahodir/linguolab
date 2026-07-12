/**
 * Утилиты сравнения расписаний классов.
 * Расписание: schedule_days (MON..SUN) + schedule_time "HH:MM" + schedule_duration (мин).
 * Все времена в одной таймзоне (UTC+5, Ташкент) — сравниваем «в минутах от полуночи».
 */

export interface ScheduleLike {
  schedule_days: string[];
  schedule_time: string | null;
  schedule_duration: number | null;
}

/** "HH:MM" → минуты от полуночи; null если не задано/битое. */
function toMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(':').map((x) => parseInt(x, 10));
  if (h === undefined || isNaN(h)) return null;
  return h * 60 + (isNaN(m ?? NaN) ? 0 : (m ?? 0));
}

/**
 * true — расписания пересекаются: есть общий день недели И интервалы времени
 * перекрываются. Если у одного из классов расписание не задано — конфликта нет
 * (нечего сравнивать; не блокируем работу до настройки).
 */
export function schedulesOverlap(a: ScheduleLike, b: ScheduleLike): boolean {
  const startA = toMinutes(a.schedule_time);
  const startB = toMinutes(b.schedule_time);
  if (startA === null || startB === null) return false;
  if (!a.schedule_days.length || !b.schedule_days.length) return false;

  const sharedDay = a.schedule_days.some((d) => b.schedule_days.includes(d));
  if (!sharedDay) return false;

  const endA = startA + (a.schedule_duration ?? 60);
  const endB = startB + (b.schedule_duration ?? 60);
  return startA < endB && startB < endA;
}
