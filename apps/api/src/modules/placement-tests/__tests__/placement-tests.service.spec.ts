/**
 * Unit-тесты для PlacementTestsService.
 *
 * Покрываем:
 *  - scoreToLevel() — граничные значения всех 6 CEFR уровней
 *  - complete() — правильный расчёт score (correct/total × 100) и level
 *  - answer() — правильный ответ / уже отвечен возвращает already_answered
 *  - start() — не создаёт новый тест если активный IN_PROGRESS не истёк
 *
 * scoreToLevel() не экспортируется — тестируем косвенно через complete().
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CEFR } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { PlacementTestsService } from '../placement-tests.service';

// ─── Моки ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  placementTest: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  language: {
    findUnique: jest.fn(),
  },
};

// ─── Тесты ────────────────────────────────────────────────────────────────────

describe('PlacementTestsService', () => {
  let service: PlacementTestsService;

  beforeEach(async () => {
    // resetAllMocks очищает ВСЁ включая очередь mockResolvedValueOnce
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlacementTestsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PlacementTestsService>(PlacementTestsService);
  });

  // ─── scoreToLevel (тест через complete()) ───────────────────────────────────

  describe('scoreToLevel (косвенно через complete())', () => {
    /**
     * Вспомогательная функция: создаёт мок теста с заданным количеством
     * правильных ответов из 15 вопросов.
     *
     * Формула: score = Math.round(correct / 15 * 100)
     * Граничные значения scoreToLevel:
     *   A1: < 25   → correct ≤ 3  → score ≤ 20
     *   A2: 25–44  → correct 4–6  → score 27–40
     *   B1: 45–59  → correct 7–8  → score 47–53
     *   B2: 60–74  → correct 9–11 → score 60–73
     *   C1: 75–89  → correct 11–13 → score 73–87
     *   C2: ≥ 90   → correct 14–15 → score 93–100
     */
    function makeTestWithCorrect(correct: number) {
      const answers = Array.from({ length: 15 }, (_, i) => ({ is_correct: i < correct }));
      return {
        id: 'test-1',
        user_id: 'user-1',
        status: 'IN_PROGRESS',
        score: null,
        level_assigned: null,
        answers,
      };
    }

    async function getLevel(correct: number): Promise<CEFR> {
      mockPrisma.placementTest.findFirst.mockResolvedValueOnce(makeTestWithCorrect(correct));
      mockPrisma.placementTest.update.mockResolvedValueOnce({});
      const result = await service.complete('test-1', 'user-1');
      return result.level as CEFR;
    }

    it('0 правильных → A1', async () => {
      expect(await getLevel(0)).toBe(CEFR.A1);
    });

    it('3 правильных → A1 (score=20)', async () => {
      expect(await getLevel(3)).toBe(CEFR.A1);
    });

    it('4 правильных → A2 (score=27)', async () => {
      expect(await getLevel(4)).toBe(CEFR.A2);
    });

    it('7 правильных → B1 (score=47)', async () => {
      expect(await getLevel(7)).toBe(CEFR.B1);
    });

    it('9 правильных → B2 (score=60)', async () => {
      expect(await getLevel(9)).toBe(CEFR.B2);
    });

    it('12 правильных → C1 (score=80)', async () => {
      expect(await getLevel(12)).toBe(CEFR.C1);
    });

    it('14 правильных → C2 (score=93)', async () => {
      expect(await getLevel(14)).toBe(CEFR.C2);
    });

    it('15 правильных → C2 (score=100)', async () => {
      expect(await getLevel(15)).toBe(CEFR.C2);
    });
  });

  // ─── complete() ─────────────────────────────────────────────────────────────

  describe('complete()', () => {
    it('бросает NotFoundException если тест не найден', async () => {
      mockPrisma.placementTest.findFirst.mockResolvedValueOnce(null);

      await expect(service.complete('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('возвращает кешированный результат если уже COMPLETED', async () => {
      mockPrisma.placementTest.findFirst.mockResolvedValueOnce({
        id: 'test-1',
        user_id: 'user-1',
        status: 'COMPLETED',
        score: 80,
        level_assigned: CEFR.C1,
      });

      const result = await service.complete('test-1', 'user-1');

      expect(result).toEqual({ score: 80, level: CEFR.C1 });
      expect(mockPrisma.placementTest.update).not.toHaveBeenCalled();
    });

    it('правильно вычисляет score из answers', async () => {
      // 9 из 15 правильных = 60%
      const answers = Array.from({ length: 15 }, (_, i) => ({ is_correct: i < 9 }));
      mockPrisma.placementTest.findFirst.mockResolvedValueOnce({
        id: 'test-1',
        user_id: 'user-1',
        status: 'IN_PROGRESS',
        answers,
      });
      mockPrisma.placementTest.update.mockResolvedValueOnce({});

      const result = await service.complete('test-1', 'user-1');

      expect(result.score).toBe(60);
      expect(result.correct).toBe(9);
      expect(result.total).toBe(15);
    });
  });

  // ─── start() ─────────────────────────────────────────────────────────────────

  describe('start()', () => {
    it('возвращает существующий тест если IN_PROGRESS и не истёк', async () => {
      const futureExpiry = new Date();
      futureExpiry.setHours(futureExpiry.getHours() + 12); // 12 часов вперёд

      mockPrisma.placementTest.findFirst.mockResolvedValueOnce({
        id: 'existing-test',
        status: 'IN_PROGRESS',
        expires_at: futureExpiry,
      });
      mockPrisma.language.findUnique.mockResolvedValueOnce({ id: 'lang-en', code: 'en' });

      const result = await service.start('user-1', 'lang-en');

      expect(result.test_id).toBe('existing-test');
      expect(mockPrisma.placementTest.create).not.toHaveBeenCalled();
    });

    it('бросает NotFoundException если language не существует', async () => {
      mockPrisma.placementTest.findFirst.mockResolvedValueOnce(null);
      mockPrisma.language.findUnique.mockResolvedValueOnce(null);

      await expect(service.start('user-1', 'bad-lang')).rejects.toThrow(NotFoundException);
    });

    it('создаёт новый тест если нет IN_PROGRESS', async () => {
      mockPrisma.placementTest.findFirst.mockResolvedValueOnce(null);
      mockPrisma.language.findUnique.mockResolvedValueOnce({ id: 'lang-en', code: 'en' });
      mockPrisma.placementTest.create.mockResolvedValueOnce({ id: 'new-test-id' });

      const result = await service.start('user-1', 'lang-en');

      expect(mockPrisma.placementTest.create).toHaveBeenCalledTimes(1);
      expect(result.test_id).toBe('new-test-id');
    });
  });

  // ─── answer() ────────────────────────────────────────────────────────────────

  describe('answer()', () => {
    it('бросает NotFoundException если тест не найден', async () => {
      mockPrisma.placementTest.findFirst.mockResolvedValueOnce(null);

      await expect(service.answer('bad-id', 'user-1', 1, 0)).rejects.toThrow(NotFoundException);
    });

    it('возвращает already_answered=true если вопрос уже отвечен', async () => {
      mockPrisma.placementTest.findFirst.mockResolvedValueOnce({
        id: 'test-1',
        user_id: 'user-1',
        status: 'IN_PROGRESS',
        expires_at: new Date(Date.now() + 3_600_000),
        answers: [{ question_id: 1, answer: 0, is_correct: true }],
      });

      const result = await service.answer('test-1', 'user-1', 1, 0);
      expect(result).toEqual({ ok: true, already_answered: true });
    });
  });
});
