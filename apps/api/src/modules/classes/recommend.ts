import type { CEFR, StudyFormat } from '@prisma/client';

import { slotOf, type TimeSlot, type Weekday } from '../users/learning-goals';

/** Уровни по порядку — нужен, чтобы считать расстояние между ними. */
const LEVEL_ORDER: CEFR[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface StudentPreferences {
  study_format: StudyFormat | null;
  self_level: CEFR | null;
  available_days: string[];
  available_slots: string[];
}

export interface CandidateClass {
  id: string;
  format: StudyFormat;
  level: CEFR;
  schedule_days: string[];
  schedule_time: string | null;
  spots_left: number;
  teacher_rating: number | null;
}

/** Почему курс оказался в выдаче — показывается студенту как есть. */
export type MatchReason =
  | 'FORMAT'
  | 'LEVEL_EXACT'
  | 'LEVEL_NEAR'
  | 'DAYS_ALL'
  | 'DAYS_SOME'
  | 'TIME'
  | 'SPOTS';

export interface ScoredClass {
  id: string;
  score: number;
  reasons: MatchReason[];
}

/**
 * Веса подбора.
 *
 * Расписание в сумме (дни + время) весит больше уровня: уровень можно
 * подвинуть на соседний, а рабочие часы студента подвинуть нельзя.
 */
const W = {
  /**
   * Формат перевешивает всё остальное вместе взятое — намеренно.
   *
   * Выбравший онлайн чаще всего физически не может ездить в центр, и очный
   * курс не подходит ему ни при каком расписании. Идеальный по дням и уровню
   * очный курс не должен обгонять неудобный онлайновый.
   *
   * Значение должно оставаться больше суммы LEVEL_EXACT + DAYS_ALL + TIME +
   * SPOTS. Это закреплено тестом: если добавится новый признак, вес формата
   * придётся поднять вместе с ним.
   */
  FORMAT: 100,
  LEVEL_EXACT: 20,
  LEVEL_NEAR: 8,
  DAYS_ALL: 25,
  DAYS_SOME: 12,
  TIME: 20,
  SPOTS: 5,
} as const;

/** Максимум, который курс может набрать без совпадения по формату. */
export const MAX_SCORE_WITHOUT_FORMAT = W.LEVEL_EXACT + W.DAYS_ALL + W.TIME + W.SPOTS;

/** Вес совпадения по формату — вынесен, чтобы инвариант можно было проверить. */
export const FORMAT_WEIGHT: number = W.FORMAT;

function levelDistance(a: CEFR, b: CEFR): number {
  return Math.abs(LEVEL_ORDER.indexOf(a) - LEVEL_ORDER.indexOf(b));
}

/**
 * Оценивает, насколько курс подходит студенту.
 *
 * Ничего не отсеивает — только ранжирует. Прятать курсы по предпочтениям
 * нельзя: предпочтения человек указал один раз в опросе и мог с тех пор
 * передумать, а пустой экран вместо каталога он воспримет как поломку.
 */
export function scoreClass(cls: CandidateClass, prefs: StudentPreferences): ScoredClass {
  const reasons: MatchReason[] = [];
  let score = 0;

  if (prefs.study_format && cls.format === prefs.study_format) {
    score += W.FORMAT;
    reasons.push('FORMAT');
  }

  if (prefs.self_level) {
    const distance = levelDistance(cls.level, prefs.self_level);
    if (distance === 0) {
      score += W.LEVEL_EXACT;
      reasons.push('LEVEL_EXACT');
    } else if (distance === 1) {
      // Соседний уровень — нормальная рекомендация: студент оценивает себя
      // на глаз и ошибается на ступень в обе стороны сплошь и рядом.
      score += W.LEVEL_NEAR;
      reasons.push('LEVEL_NEAR');
    }
  }

  if (prefs.available_days.length > 0 && cls.schedule_days.length > 0) {
    const free = new Set(prefs.available_days);
    const fits = cls.schedule_days.filter((d) => free.has(d)).length;
    if (fits === cls.schedule_days.length) {
      // Все занятия попадают в свободные дни — студент не пропустит ни одного.
      score += W.DAYS_ALL;
      reasons.push('DAYS_ALL');
    } else if (fits > 0) {
      // Частичное совпадение ценно пропорционально: курс, где подходит один
      // день из трёх, не должен идти вровень с тем, где подходят два.
      score += Math.round((W.DAYS_SOME * fits) / cls.schedule_days.length);
      reasons.push('DAYS_SOME');
    }
  }

  const slot = slotOf(cls.schedule_time);
  if (slot && prefs.available_slots.includes(slot)) {
    score += W.TIME;
    reasons.push('TIME');
  }

  // Небольшая добавка, а не фильтр: заполненная группа остаётся в выдаче,
  // на неё можно встать в очередь.
  if (cls.spots_left > 0) {
    score += W.SPOTS;
    reasons.push('SPOTS');
  }

  return { id: cls.id, score, reasons };
}

/**
 * Ранжирует курсы: сначала подходящие, при равном счёте — с лучшим
 * преподавателем, затем с большим числом свободных мест.
 *
 * Порядок при полном равенстве закрепляем по id, иначе выдача прыгает между
 * запросами и студенту кажется, что список живёт своей жизнью.
 */
export function rankClasses(
  classes: CandidateClass[],
  prefs: StudentPreferences,
): (ScoredClass & { cls: CandidateClass })[] {
  return classes
    .map((cls) => ({ ...scoreClass(cls, prefs), cls }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.cls.teacher_rating ?? -1) - (a.cls.teacher_rating ?? -1) ||
        b.cls.spots_left - a.cls.spots_left ||
        a.cls.id.localeCompare(b.cls.id),
    );
}
