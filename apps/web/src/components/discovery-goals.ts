import type { LanguageCategory } from '../api/languages';
import type { TimeSlot, Weekday } from '../api/users';

/**
 * Зачем человек учится — в разрезе направления.
 *
 * Ключи обязаны совпадать с apps/api/src/modules/users/learning-goals.ts:
 * бэк отбрасывает цель, которой нет в списке её направления, и разошедшийся
 * набор молча превратился бы в «цель не указана» у каждого второго.
 *
 * Списки разные не для красоты: «для путешествий» бессмысленно у DTM, куда
 * идут только ради поступления, а «для поступления» ничего не говорит про
 * английский, который учат и для работы, и для себя.
 */
export const GOALS_BY_CATEGORY: Record<LanguageCategory, readonly string[]> = {
  LANGUAGES: ['SELF', 'WORK', 'STUDY', 'TRAVEL', 'MOVING'],
  IELTS: ['STUDY_ABROAD', 'WORK_ABROAD', 'MOVING', 'UNIVERSITY_REQUIREMENT'],
  SAT: ['STUDY_ABROAD', 'SCHOLARSHIP'],
  CEFR: ['UNIVERSITY_REQUIREMENT', 'WORK', 'SELF'],
  DTM: ['UNIVERSITY_ADMISSION'],
  MILLIY_SERTIFIKAT: ['SALARY_BONUS', 'WORK', 'UNIVERSITY_REQUIREMENT'],
};

export function goalsFor(category: LanguageCategory | null): readonly string[] {
  return category ? GOALS_BY_CATEGORY[category] : GOALS_BY_CATEGORY.LANGUAGES;
}

export const GOAL_LABEL: Record<string, { title: string; description: string; art: string }> = {
  SELF: {
    title: 'Для себя',
    description: 'Свободно смотреть фильмы, читать и общаться без словаря.',
    art: '🌱',
  },
  WORK: {
    title: 'Для работы',
    description: 'Переписка, созвоны и переговоры с иностранными коллегами.',
    art: '💼',
  },
  STUDY: {
    title: 'Для учёбы',
    description: 'Понимать лекции, литературу и сдавать предмет в вузе.',
    art: '📚',
  },
  TRAVEL: {
    title: 'Для путешествий',
    description: 'Не теряться в аэропорту, отеле и на улице чужого города.',
    art: '✈️',
  },
  MOVING: {
    title: 'Для переезда',
    description: 'Жить, работать и решать бытовые вопросы за границей.',
    art: '🧳',
  },
  STUDY_ABROAD: {
    title: 'Поступление за рубеж',
    description: 'Набрать балл, который примет выбранный университет.',
    art: '🎓',
  },
  WORK_ABROAD: {
    title: 'Работа за рубежом',
    description: 'Подтвердить язык для работодателя или визы.',
    art: '🌍',
  },
  UNIVERSITY_REQUIREMENT: {
    title: 'Требование вуза',
    description: 'Нужен сертификат, без которого не допускают.',
    art: '📋',
  },
  UNIVERSITY_ADMISSION: {
    title: 'Поступление в вуз',
    description: 'Пройти по баллам на выбранное направление.',
    art: '🏛️',
  },
  SCHOLARSHIP: {
    title: 'Стипендия или грант',
    description: 'Балл выше проходного, чтобы претендовать на финансирование.',
    art: '🏆',
  },
  SALARY_BONUS: {
    title: 'Надбавка к зарплате',
    description: 'Сертификат, который повышает разряд или оклад.',
    art: '💰',
  },
};

/** Уровни с человеческим описанием — по ним студент оценивает себя сам. */
export const LEVEL_OPTIONS: { level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'; hint: string }[] = [
  { level: 'A1', hint: 'Начинаю с нуля или помню отдельные слова' },
  { level: 'A2', hint: 'Могу сказать простое о себе и понять простую речь' },
  { level: 'B1', hint: 'Объяснюсь в быту, понимаю основную мысль' },
  { level: 'B2', hint: 'Свободно говорю на знакомые темы, смотрю фильмы' },
  { level: 'C1', hint: 'Говорю почти без усилий, понимаю сложные тексты' },
  { level: 'C2', hint: 'Владею близко к носителю' },
];

export const WEEKDAYS: { day: Weekday; short: string }[] = [
  { day: 'MON', short: 'Пн' },
  { day: 'TUE', short: 'Вт' },
  { day: 'WED', short: 'Ср' },
  { day: 'THU', short: 'Чт' },
  { day: 'FRI', short: 'Пт' },
  { day: 'SAT', short: 'Сб' },
  { day: 'SUN', short: 'Вс' },
];

export const TIME_SLOTS: { slot: TimeSlot; title: string; hint: string; art: string }[] = [
  { slot: 'MORNING', title: 'Утро', hint: 'с 6:00 до 12:00', art: '🌅' },
  { slot: 'AFTERNOON', title: 'День', hint: 'с 12:00 до 17:00', art: '☀️' },
  { slot: 'EVENING', title: 'Вечер', hint: 'с 17:00 до 23:00', art: '🌙' },
];
