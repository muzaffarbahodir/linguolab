/**
 * Подбор курса по предпочтениям студента.
 *
 * Проверяем не абсолютные баллы (веса ещё будут двигаться), а порядок и
 * правила, ради которых подбор затевался: онлайн впереди у того, кто выбрал
 * онлайн; полное совпадение по дням выше частичного; ничего не исчезает из
 * выдачи, если предпочтения не совпали.
 */
import {
  FORMAT_WEIGHT,
  MAX_SCORE_WITHOUT_FORMAT,
  rankClasses,
  scoreClass,
  type CandidateClass,
  type StudentPreferences,
} from '../recommend';
import { slotOf } from '../../users/learning-goals';

const BASE_CLASS: CandidateClass = {
  id: 'c1',
  format: 'OFFLINE',
  level: 'B1',
  schedule_days: ['MON', 'WED'],
  schedule_time: '18:00',
  spots_left: 3,
  teacher_rating: 4.5,
};

const NO_PREFS: StudentPreferences = {
  study_format: null,
  self_level: null,
  available_days: [],
  available_slots: [],
};

const cls = (over: Partial<CandidateClass>): CandidateClass => ({ ...BASE_CLASS, ...over });

describe('slotOf', () => {
  it.each([
    ['08:00', 'MORNING'],
    ['11:59', 'MORNING'],
    ['12:00', 'AFTERNOON'],
    ['16:30', 'AFTERNOON'],
    ['17:00', 'EVENING'],
    ['22:00', 'EVENING'],
    ['9:00', 'MORNING'],
  ])('%s → %s', (time, expected) => {
    expect(slotOf(time)).toBe(expected);
  });

  it('не приписывает ночные часы к утру', () => {
    // Занятий в три ночи не бывает; молча отнести их к утру значило бы
    // подсунуть студенту курс, на который он не пойдёт.
    expect(slotOf('03:00')).toBeNull();
  });

  it('переживает мусор вместо времени', () => {
    expect(slotOf(null)).toBeNull();
    expect(slotOf('')).toBeNull();
    expect(slotOf('вечером')).toBeNull();
    expect(slotOf('25:00')).toBeNull();
    expect(slotOf('18:70')).toBeNull();
  });
});

describe('scoreClass', () => {
  it('без предпочтений различает курсы только по наличию мест', () => {
    const withSpots = scoreClass(cls({ spots_left: 2 }), NO_PREFS);
    const full = scoreClass(cls({ spots_left: 0 }), NO_PREFS);

    expect(withSpots.reasons).toEqual(['SPOTS']);
    expect(full.reasons).toEqual([]);
  });

  it('засчитывает совпадение формата', () => {
    const prefs = { ...NO_PREFS, study_format: 'ONLINE' as const };

    expect(scoreClass(cls({ format: 'ONLINE' }), prefs).reasons).toContain('FORMAT');
    expect(scoreClass(cls({ format: 'OFFLINE' }), prefs).reasons).not.toContain('FORMAT');
  });

  it('считает соседний уровень подходящим, но слабее точного', () => {
    const prefs = { ...NO_PREFS, self_level: 'B1' as const };

    const exact = scoreClass(cls({ level: 'B1' }), prefs);
    const near = scoreClass(cls({ level: 'B2' }), prefs);
    const far = scoreClass(cls({ level: 'C2' }), prefs);

    expect(exact.reasons).toContain('LEVEL_EXACT');
    expect(near.reasons).toContain('LEVEL_NEAR');
    expect(far.reasons).not.toContain('LEVEL_NEAR');
    expect(exact.score).toBeGreaterThan(near.score);
    expect(near.score).toBeGreaterThan(far.score);
  });

  it('различает полное и частичное попадание по дням', () => {
    const prefs = { ...NO_PREFS, available_days: ['MON', 'WED'] };

    const all = scoreClass(cls({ schedule_days: ['MON', 'WED'] }), prefs);
    const some = scoreClass(cls({ schedule_days: ['MON', 'TUE'] }), prefs);
    const none = scoreClass(cls({ schedule_days: ['TUE', 'THU'] }), prefs);

    expect(all.reasons).toContain('DAYS_ALL');
    expect(some.reasons).toContain('DAYS_SOME');
    expect(none.reasons).not.toContain('DAYS_SOME');
    expect(all.score).toBeGreaterThan(some.score);
  });

  it('оценивает частичное попадание пропорционально числу дней', () => {
    const prefs = { ...NO_PREFS, available_days: ['MON', 'WED'] };

    const twoOfThree = scoreClass(cls({ schedule_days: ['MON', 'WED', 'FRI'] }), prefs);
    const oneOfThree = scoreClass(cls({ schedule_days: ['MON', 'TUE', 'FRI'] }), prefs);

    expect(twoOfThree.score).toBeGreaterThan(oneOfThree.score);
  });

  it('засчитывает удобное время занятия', () => {
    const prefs = { ...NO_PREFS, available_slots: ['EVENING'] };

    expect(scoreClass(cls({ schedule_time: '19:00' }), prefs).reasons).toContain('TIME');
    expect(scoreClass(cls({ schedule_time: '09:00' }), prefs).reasons).not.toContain('TIME');
  });

  it('не падает на курсе без расписания', () => {
    const prefs = { ...NO_PREFS, available_days: ['MON'], available_slots: ['EVENING'] };
    const result = scoreClass(cls({ schedule_days: [], schedule_time: null }), prefs);

    expect(result.reasons).not.toContain('DAYS_SOME');
    expect(result.reasons).not.toContain('TIME');
  });
});

describe('rankClasses', () => {
  const ONLINE_PREFS: StudentPreferences = {
    study_format: 'ONLINE',
    self_level: 'B1',
    available_days: ['MON', 'WED'],
    available_slots: ['EVENING'],
  };

  it('ставит онлайн вперёд, когда студент выбрал онлайн', () => {
    const ranked = rankClasses(
      [cls({ id: 'offline', format: 'OFFLINE' }), cls({ id: 'online', format: 'ONLINE' })],
      ONLINE_PREFS,
    );

    expect(ranked[0]?.id).toBe('online');
  });

  it('не выкидывает неподходящие курсы из выдачи', () => {
    // Предпочтения человек указал один раз и мог передумать. Пустой каталог
    // он воспримет как поломку, а не как заботу о нём.
    const ranked = rankClasses(
      [
        cls({ id: 'wrong', format: 'OFFLINE', level: 'C2', schedule_days: ['SAT'] }),
        cls({ id: 'right', format: 'ONLINE' }),
      ],
      ONLINE_PREFS,
    );

    expect(ranked).toHaveLength(2);
    expect(ranked.map((r) => r.id)).toContain('wrong');
  });

  it('при равном совпадении предпочитает преподавателя с лучшим рейтингом', () => {
    const ranked = rankClasses(
      [
        cls({ id: 'weak', format: 'ONLINE', teacher_rating: 3.9 }),
        cls({ id: 'strong', format: 'ONLINE', teacher_rating: 4.9 }),
      ],
      ONLINE_PREFS,
    );

    expect(ranked[0]?.id).toBe('strong');
  });

  it('преподаватель без оценок уступает оценённому', () => {
    const ranked = rankClasses(
      [
        cls({ id: 'unrated', format: 'ONLINE', teacher_rating: null }),
        cls({ id: 'rated', format: 'ONLINE', teacher_rating: 3.0 }),
      ],
      ONLINE_PREFS,
    );

    expect(ranked[0]?.id).toBe('rated');
  });

  it('даёт устойчивый порядок при полном равенстве', () => {
    // Иначе выдача прыгает между запросами и выглядит сломанной.
    const same = [cls({ id: 'b' }), cls({ id: 'a' }), cls({ id: 'c' })];
    const first = rankClasses(same, NO_PREFS).map((r) => r.id);
    const second = rankClasses([...same].reverse(), NO_PREFS).map((r) => r.id);

    expect(first).toEqual(['a', 'b', 'c']);
    expect(second).toEqual(first);
  });

  it('ставит онлайн первым даже когда очный курс подходит идеально', () => {
    // Требование заказчика: выбравшему онлайн предлагать онлайн на первом
    // месте. Выбравший онлайн чаще всего физически не может ездить в центр,
    // и очный курс не подходит ему ни при каком расписании.
    const ranked = rankClasses(
      [
        cls({ id: 'offline-perfect', format: 'OFFLINE' }),
        cls({
          id: 'online-awkward',
          format: 'ONLINE',
          schedule_days: ['SAT', 'SUN'],
          schedule_time: '09:00',
          level: 'C1',
          spots_left: 0,
        }),
      ],
      ONLINE_PREFS,
    );

    expect(ranked[0]?.id).toBe('online-awkward');
  });

  it('вес формата перекрывает сумму всех остальных признаков', () => {
    // Инвариант, а не следствие текущих чисел: если добавится новый признак
    // или подрастёт вес расписания, этот тест упадёт раньше, чем очный курс
    // тихо обгонит онлайновый в выдаче.
    expect(FORMAT_WEIGHT).toBeGreaterThan(MAX_SCORE_WITHOUT_FORMAT);
  });
});
