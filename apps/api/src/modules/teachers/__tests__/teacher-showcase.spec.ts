/**
 * Витрина преподавателя: статистика и отзывы.
 *
 * Цифры отсюда попадают на публичную страницу и служат аргументом при выборе.
 * Завышенный счётчик учеников — прямой обман, поэтому проверяем именно те
 * места, где легко посчитать лишнее: один ученик на двух курсах и уроки
 * закрытых групп.
 */
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { TeachersService } from '../teachers.service';

const mockPrisma = {
  teacher: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  class: { findMany: jest.fn() },
  lesson: { groupBy: jest.fn() },
  enrollment: { findMany: jest.fn() },
};

/** Профиль-заготовка: значимые поля тесты переопределяют сами. */
const BASE_TEACHER = {
  id: 't1',
  bio: null,
  photo_url: null,
  headline: null,
  intro_video_url: null,
  intro_video_poster: null,
  country: null,
  experience_years: null,
  specializations: [],
  highlights: [],
  speaks: null,
  education: null,
  user: { id: 'u1', first_name: 'Ivan', last_name: 'Petrov', avatar_url: null },
  ratings: [],
  badges: [],
  classes: [],
};

describe('TeachersService — витрина', () => {
  let service: TeachersService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeachersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(TeachersService);
  });

  describe('статистика', () => {
    it('не считает одного ученика дважды, если он ходит на два курса', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue(BASE_TEACHER);
      mockPrisma.class.findMany.mockResolvedValue([
        { id: 'c1', teacher_id: 't1' },
        { id: 'c2', teacher_id: 't1' },
      ]);
      mockPrisma.lesson.groupBy.mockResolvedValue([]);
      mockPrisma.enrollment.findMany.mockResolvedValue([
        { student_id: 's1', class_id: 'c1' },
        { student_id: 's1', class_id: 'c2' },
        { student_id: 's2', class_id: 'c1' },
      ]);

      const profile = await service.findOne('t1');

      expect(profile.students_count).toBe(2);
    });

    it('складывает проведённые уроки по всем группам преподавателя', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue(BASE_TEACHER);
      mockPrisma.class.findMany.mockResolvedValue([
        { id: 'c1', teacher_id: 't1' },
        { id: 'c2', teacher_id: 't1' },
      ]);
      mockPrisma.lesson.groupBy.mockResolvedValue([
        { class_id: 'c1', _count: { _all: 40 } },
        { class_id: 'c2', _count: { _all: 12 } },
      ]);
      mockPrisma.enrollment.findMany.mockResolvedValue([]);

      const profile = await service.findOne('t1');

      expect(profile.lessons_conducted).toBe(52);
    });

    it('у преподавателя без групп показывает нули, а не падает', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue(BASE_TEACHER);
      mockPrisma.class.findMany.mockResolvedValue([]);

      const profile = await service.findOne('t1');

      expect(profile.lessons_conducted).toBe(0);
      expect(profile.students_count).toBe(0);
      // Групп нет — тяжёлые запросы делать не за чем.
      expect(mockPrisma.lesson.groupBy).not.toHaveBeenCalled();
      expect(mockPrisma.enrollment.findMany).not.toHaveBeenCalled();
    });

    it('не приписывает преподавателю уроки чужой группы', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue(BASE_TEACHER);
      mockPrisma.class.findMany.mockResolvedValue([{ id: 'c1', teacher_id: 't1' }]);
      mockPrisma.lesson.groupBy.mockResolvedValue([
        { class_id: 'c1', _count: { _all: 5 } },
        // Группа, которой нет в карте: приписывать её некому.
        { class_id: 'c-alien', _count: { _all: 99 } },
      ]);
      mockPrisma.enrollment.findMany.mockResolvedValue([]);

      const profile = await service.findOne('t1');

      expect(profile.lessons_conducted).toBe(5);
    });
  });

  describe('отзывы', () => {
    const withRatings = (ratings: unknown[]) => ({ ...BASE_TEACHER, ratings });

    beforeEach(() => {
      mockPrisma.class.findMany.mockResolvedValue([]);
    });

    it('сокращает фамилию автора до инициала', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue(
        withRatings([
          {
            rating: 5,
            comment: 'Отличный преподаватель',
            created_at: new Date('2026-07-01'),
            student: { first_name: 'Азиз', last_name: 'Каримов', avatar_url: null },
            class: { title: 'English B1' },
          },
        ]),
      );

      const profile = await service.findOne('t1');

      expect(profile.recent_reviews?.[0]?.author?.name).toBe('Азиз К.');
    });

    it('обходится без фамилии, если её нет', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue(
        withRatings([
          {
            rating: 5,
            comment: 'Хорошо',
            created_at: new Date('2026-07-01'),
            student: { first_name: 'Азиз', last_name: null, avatar_url: null },
            class: { title: 'English B1' },
          },
        ]),
      );

      const profile = await service.findOne('t1');

      expect(profile.recent_reviews?.[0]?.author?.name).toBe('Азиз');
    });

    it('не показывает оценки без текста как отзывы', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue(
        withRatings([
          { rating: 5, comment: null, student: { first_name: 'A', last_name: null } },
          { rating: 4, comment: '   ', student: { first_name: 'B', last_name: null } },
          { rating: 5, comment: 'Есть что сказать', student: { first_name: 'C', last_name: null } },
        ]),
      );

      const profile = await service.findOne('t1');

      // В звёздах учитываются все три, в ленте отзывов — только содержательный.
      expect(profile.ratings_count).toBe(3);
      expect(profile.recent_reviews).toHaveLength(1);
    });
  });

  describe('разбор Json-полей', () => {
    beforeEach(() => {
      mockPrisma.class.findMany.mockResolvedValue([]);
    });

    it('отбрасывает записи без названия языка, оставляя остальные', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue({
        ...BASE_TEACHER,
        speaks: [
          { name: 'English', level: 'C2' },
          { level: 'B1' },
          { name: '   ', level: 'A1' },
          { name: 'Русский', level: 'Native' },
        ],
      });

      const profile = await service.findOne('t1');

      expect(profile.speaks).toEqual([
        { name: 'English', level: 'C2' },
        { name: 'Русский', level: 'Native' },
      ]);
    });

    it('переживает мусор вместо массива', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue({
        ...BASE_TEACHER,
        speaks: 'English',
        education: { title: 'не массив' },
      });

      const profile = await service.findOne('t1');

      expect(profile.speaks).toEqual([]);
      expect(profile.education).toEqual([]);
    });

    it('пропускает год образования, только если он целое число', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue({
        ...BASE_TEACHER,
        education: [
          { title: 'Магистр', org: 'НУУз', year: 2018 },
          { title: 'Курс', year: '2020' },
        ],
      });

      const profile = await service.findOne('t1');

      expect(profile.education).toEqual([
        { title: 'Магистр', org: 'НУУз', year: 2018 },
        { title: 'Курс', org: undefined, year: undefined },
      ]);
    });
  });

  describe('черты преподавателя', () => {
    it('оставляет шесть непустых черт, а не шесть строк подряд', async () => {
      mockPrisma.teacher.findUnique.mockResolvedValue({ id: 't1' });
      mockPrisma.teacher.update.mockImplementation((args: { data: { highlights: string[] } }) =>
        Promise.resolve({ id: 't1', highlights: args.data.highlights }),
      );

      const result = await service.setHighlights('t1', [
        ' Терпеливый ',
        '',
        'Структурный',
        'Мотивирует',
        'Ставит цели',
        'Готовит к экзамену',
        'Работает с детьми',
        'Седьмая — лишняя',
      ]);

      // Пустая строка не должна была съесть одно из шести мест.
      expect(result.highlights).toEqual([
        'Терпеливый',
        'Структурный',
        'Мотивирует',
        'Ставит цели',
        'Готовит к экзамену',
        'Работает с детьми',
      ]);
    });
  });
});
