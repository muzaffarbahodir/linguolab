/**
 * Удержание и рентабельность.
 *
 * Обе цифры идут владельцу и влияют на решения — закрыть группу, поднять цену,
 * расстаться с преподавателем. Поэтому проверяем не только арифметику, но и
 * отказ считать там, где данных для честного ответа нет.
 */
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { BusinessStatsService } from '../business-stats.service';

const mockPrisma = {
  enrollment: { findMany: jest.fn() },
  class: { findMany: jest.fn() },
  employee: { findMany: jest.fn() },
};

function classFixture(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    title: 'English A1',
    teacher: {
      user_id: 'u-teacher',
      user: { first_name: 'Aziz', last_name: 'Karimov' },
    },
    _count: { enrollments: 5 },
    lessons: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }, { id: 'l4' }],
    payments: [{ amount_tiyin: 300_000_00 }, { amount_tiyin: 200_000_00 }],
    ...over,
  };
}

describe('BusinessStatsService', () => {
  let service: BusinessStatsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [BusinessStatsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();
    service = module.get(BusinessStatsService);
  });

  describe('рентабельность группы', () => {
    it('за урок: выручка минус занятия × ставку', async () => {
      mockPrisma.class.findMany.mockResolvedValue([classFixture()]);
      mockPrisma.employee.findMany.mockResolvedValue([
        { user_id: 'u-teacher', salary_type: 'PER_LESSON', rate_uzs: 50_000, rate_percent: 0 },
      ]);

      const [row] = await service.classProfitability(new Date(0), new Date());

      expect(row!.revenue_uzs).toBe(500_000);
      expect(row!.teacher_cost_uzs).toBe(200_000); // 4 занятия × 50 000
      expect(row!.profit_uzs).toBe(300_000);
      expect(row!.cost_note).toBeNull();
    });

    it('процент от выручки: считается от выручки этой же группы', async () => {
      mockPrisma.class.findMany.mockResolvedValue([classFixture()]);
      mockPrisma.employee.findMany.mockResolvedValue([
        { user_id: 'u-teacher', salary_type: 'REVENUE_SHARE', rate_uzs: 0, rate_percent: 40 },
      ]);

      const [row] = await service.classProfitability(new Date(0), new Date());

      expect(row!.teacher_cost_uzs).toBe(200_000);
      expect(row!.profit_uzs).toBe(300_000);
    });

    it('оклад к группе не привязан — прибыль не выдумываем', async () => {
      mockPrisma.class.findMany.mockResolvedValue([classFixture()]);
      mockPrisma.employee.findMany.mockResolvedValue([
        { user_id: 'u-teacher', salary_type: 'FIXED', rate_uzs: 5_000_000, rate_percent: 0 },
      ]);

      const [row] = await service.classProfitability(new Date(0), new Date());

      expect(row!.revenue_uzs).toBe(500_000); // выручку показать честно можно
      expect(row!.teacher_cost_uzs).toBeNull();
      expect(row!.profit_uzs).toBeNull();
      expect(row!.cost_note).toContain('Оклад');
    });

    it('преподаватель не заведён сотрудником — объясняем, а не молчим', async () => {
      mockPrisma.class.findMany.mockResolvedValue([classFixture()]);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const [row] = await service.classProfitability(new Date(0), new Date());

      expect(row!.profit_uzs).toBeNull();
      expect(row!.cost_note).toContain('не заведён');
    });

    it('убыточные группы сверху', async () => {
      mockPrisma.class.findMany.mockResolvedValue([
        classFixture({ id: 'rich', payments: [{ amount_tiyin: 900_000_00 }] }),
        classFixture({ id: 'poor', payments: [{ amount_tiyin: 100_000_00 }] }),
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([
        { user_id: 'u-teacher', salary_type: 'PER_LESSON', rate_uzs: 50_000, rate_percent: 0 },
      ]);

      const rows = await service.classProfitability(new Date(0), new Date());
      expect(rows.map((r) => r.class_id)).toEqual(['poor', 'rich']);
    });
  });

  describe('удержание', () => {
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 5));

    function monthsAfter(d: Date, m: number) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m, 5));
    }

    it('считает долю доживших накопительно', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([
        // Дожил до 3-го месяца.
        {
          student_id: 's1',
          status: 'ACTIVE',
          enrolled_at: thisMonth,
          paid_until: monthsAfter(thisMonth, 3),
        },
        // Дожил только до 1-го.
        {
          student_id: 's2',
          status: 'DROPPED',
          enrolled_at: thisMonth,
          paid_until: monthsAfter(thisMonth, 1),
        },
      ]);

      const [cohort] = await service.retention(6);

      expect(cohort!.students).toBe(2);
      expect(cohort!.month_1_pct).toBe(100); // оба дожили до первого
      expect(cohort!.month_2_pct).toBe(50); // остался один
      expect(cohort!.month_3_pct).toBe(50);
    });

    it('пробные не считаются оттоком — их не берём вовсе', async () => {
      mockPrisma.enrollment.findMany.mockResolvedValue([]);
      await service.retention(6);
      expect(mockPrisma.enrollment.findMany.mock.calls[0]![0].where.is_trial).toBe(false);
    });

    it('переход между группами не создаёт вторую когорту', async () => {
      // Один и тот же студент с двумя записями: когорта считается по первой.
      mockPrisma.enrollment.findMany.mockResolvedValue([
        {
          student_id: 's1',
          status: 'DROPPED',
          enrolled_at: thisMonth,
          paid_until: monthsAfter(thisMonth, 1),
        },
        {
          student_id: 's1',
          status: 'ACTIVE',
          enrolled_at: monthsAfter(thisMonth, 1),
          paid_until: monthsAfter(thisMonth, 3),
        },
      ]);

      const cohorts = await service.retention(6);

      expect(cohorts).toHaveLength(1);
      expect(cohorts[0]!.students).toBe(1);
      // Учитывается наибольшая дата — студент не потерялся при переводе.
      expect(cohorts[0]!.month_3_pct).toBe(100);
    });
  });
});
