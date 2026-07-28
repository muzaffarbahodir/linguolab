import type { LanguageCategory } from '@prisma/client';

/**
 * Зачем человек учится — в разрезе направления.
 *
 * Списки разные не для красоты: «для путешествий» бессмысленно у DTM, куда
 * идут только ради поступления, а «для поступления» ничего не говорит про
 * английский, который учат и для работы, и для себя. Общий перечень заставил
 * бы студента выбирать из вариантов, половина которых к его случаю не
 * относится, — и ответ перестал бы что-либо значить.
 *
 * Ключи стабильные: попадают в БД и в аналитику, переименование ломает
 * накопленные ответы. Подписи живут в переводах на клиенте.
 */
export const GOALS_BY_CATEGORY: Record<LanguageCategory, readonly string[]> = {
  LANGUAGES: ['SELF', 'WORK', 'STUDY', 'TRAVEL', 'MOVING'],
  IELTS: ['STUDY_ABROAD', 'WORK_ABROAD', 'MOVING', 'UNIVERSITY_REQUIREMENT'],
  SAT: ['STUDY_ABROAD', 'SCHOLARSHIP'],
  CEFR: ['UNIVERSITY_REQUIREMENT', 'WORK', 'SELF'],
  DTM: ['UNIVERSITY_ADMISSION'],
  MILLIY_SERTIFIKAT: ['SALARY_BONUS', 'WORK', 'UNIVERSITY_REQUIREMENT'],
};

/** Когда направление не выбрано, спрашиваем общими словами. */
export const DEFAULT_GOALS: readonly string[] = GOALS_BY_CATEGORY.LANGUAGES;

export function goalsFor(category: LanguageCategory | null | undefined): readonly string[] {
  return category ? GOALS_BY_CATEGORY[category] : DEFAULT_GOALS;
}

/**
 * Цель принимается, только если она есть в списке своего направления.
 *
 * Иначе в базе оседало бы «TRAVEL» у абитуриента DTM — цифра, которой потом
 * нельзя пользоваться при разговоре с клиентом.
 */
export function isValidGoal(
  goal: string | null | undefined,
  category: LanguageCategory | null | undefined,
): goal is string {
  return !!goal && goalsFor(category).includes(goal);
}

/** Дни недели в том виде, в каком они лежат в Class.schedule_days. */
export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/**
 * Отрезки дня вместо точного часа.
 *
 * Студент выбирает время до того, как увидел расписание групп, и назвать
 * точный час не может. «Вечер» же сопоставляется с 18:00 однозначно.
 */
export const TIME_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING'] as const;
export type TimeSlot = (typeof TIME_SLOTS)[number];

/** Границы отрезков в часах: [начало, конец). */
const SLOT_HOURS: Record<TimeSlot, [number, number]> = {
  MORNING: [6, 12],
  AFTERNOON: [12, 17],
  EVENING: [17, 23],
};

/**
 * В какой отрезок попадает время занятия («18:30» → EVENING).
 *
 * Возвращает null для мусора и для ночных часов: занятий в три ночи не
 * бывает, и молча приписывать их к утру — значит подсунуть студенту курс,
 * на который он не пойдёт.
 */
export function slotOf(scheduleTime: string | null | undefined): TimeSlot | null {
  if (!scheduleTime) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(scheduleTime.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour > 23 || minute > 59) return null;

  for (const slot of TIME_SLOTS) {
    const [from, to] = SLOT_HOURS[slot];
    if (hour >= from && hour < to) return slot;
  }
  return null;
}

/** Оставляет из присланного только известные значения, в заданном порядке. */
function keepKnown<T extends string>(raw: unknown, known: readonly T[]): T[] {
  if (!Array.isArray(raw)) return [];
  const picked = new Set(raw.filter((v): v is string => typeof v === 'string'));
  // Идём по known, а не по raw: порядок дней получается календарный сам собой,
  // и повторы отсеиваются без отдельной проверки.
  return known.filter((v) => picked.has(v));
}

export function sanitizeDays(raw: unknown): Weekday[] {
  return keepKnown(raw, WEEKDAYS);
}

export function sanitizeSlots(raw: unknown): TimeSlot[] {
  return keepKnown(raw, TIME_SLOTS);
}
