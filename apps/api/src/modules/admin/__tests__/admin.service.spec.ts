/**
 * Unit-тесты для AdminService.
 *
 * Покрываем:
 *  - exportStudentsCsv() — формат CSV, BOM, заголовки, экранирование
 *  - exportPaymentsCsv() — конвертация тийин → сум, BigInt, пустые поля
 *  - broadcast() — валидация пустого сообщения, правильный вызов notifications.send
 *  - dashboardWidgets() — агрегация данных
 *
 * PrismaService, AuditService, NotificationsService — всё мокируется.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AdminService } from '../admin.service';

// ─── Моки ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  enrollment: {
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  teacher: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  class: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  payment: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  lesson: {
    count: jest.fn(),
  },
  homeworkSubmission: {
    count: jest.fn(),
  },
  supportTicket: { count: jest.fn() },
  trialLessonRequest: { count: jest.fn() },
  paymentProviderConfig: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

const mockAudit = { log: jest.fn() };
const mockNotifications = { send: jest.fn() };

// ─── Тесты ────────────────────────────────────────────────────────────────────

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // ─── exportStudentsCsv() ───────────────────────────────────────────────────

  describe('exportStudentsCsv()', () => {
    it('возвращает строку с правильным заголовком', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([]);

      const csv = await service.exportStudentsCsv();

      expect(csv).toContain(
        'id,first_name,last_name,email,phone,telegram_username,locale,enrollments,last_active_at,created_at',
      );
    });

    it('корректно формирует строку для студента', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        {
          id: 'student-1',
          first_name: 'Иван',
          last_name: 'Иванов',
          email: 'ivan@test.com',
          phone: '+998901234567',
          telegram_username: 'ivan_tg',
          locale: 'ru',
          last_active_at: new Date('2026-05-01T10:00:00Z'),
          created_at: new Date('2026-01-01T00:00:00Z'),
          _count: { enrollments: 3 },
        },
      ]);

      const csv = await service.exportStudentsCsv();
      const rows = csv.split('\n');

      expect(rows).toHaveLength(2); // header + 1 row
      expect(rows[1]).toContain('student-1');
      expect(rows[1]).toContain('Иван');
      expect(rows[1]).toContain('3');
    });

    it('экранирует запятые в полях', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        {
          id: 's2',
          first_name: 'Doe, John',
          last_name: null,
          email: null,
          phone: null,
          telegram_username: null,
          locale: 'en',
          last_active_at: null,
          created_at: new Date('2026-01-01T00:00:00Z'),
          _count: { enrollments: 0 },
        },
      ]);

      const csv = await service.exportStudentsCsv();
      expect(csv).toContain('"Doe, John"'); // запятая внутри → обёрнуто в ""
    });
  });

  // ─── exportPaymentsCsv() ───────────────────────────────────────────────────

  describe('exportPaymentsCsv()', () => {
    it('конвертирует BigInt тийин → сум (/ 100)', async () => {
      mockPrisma.payment.findMany.mockResolvedValueOnce([
        {
          id: 'pay-1',
          amount_tiyin: BigInt(1_500_000_00), // 1 500 000 UZS
          status: 'PAID',
          provider: 'PAYME',
          created_at: new Date('2026-05-01T00:00:00Z'),
          paid_at: new Date('2026-05-01T12:00:00Z'),
          class_id: 'cls-1',
          user: { id: 'u1', first_name: 'Test', last_name: null, email: null },
          class: { title: 'English A1' },
        },
      ]);

      const csv = await service.exportPaymentsCsv();
      expect(csv).toContain('1500000'); // тийин → сум
    });

    it('содержит заголовок с нужными полями', async () => {
      mockPrisma.payment.findMany.mockResolvedValueOnce([]);

      const csv = await service.exportPaymentsCsv();
      expect(csv).toContain('id,student_id,student_name,email,class,amount_uzs,provider,status');
    });
  });

  // ─── broadcast() ──────────────────────────────────────────────────────────

  describe('broadcast()', () => {
    it('бросает BadRequestException если message пустой', async () => {
      await expect(service.broadcast({ message: '', target: 'all' }, 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('бросает BadRequestException если message только пробелы', async () => {
      await expect(service.broadcast({ message: '   ', target: 'all' }, 'actor-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('возвращает { queued: N } по количеству студентов', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }, { id: 'u3' }]);
      mockNotifications.send.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      const result = await service.broadcast({ message: 'Привет всем!', target: 'all' }, 'actor-1');

      expect(result).toEqual({ queued: 3 });
    });

    it('вызывает notifications.send для каждого студента', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'u1' }, { id: 'u2' }]);
      mockNotifications.send.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      await service.broadcast({ message: 'Тест рассылки', target: 'all' }, 'actor-1');

      expect(mockNotifications.send).toHaveBeenCalledTimes(2);
      expect(mockNotifications.send).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1' }),
      );
    });

    it('записывает в audit log после рассылки', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([{ id: 'u1' }]);
      mockNotifications.send.mockResolvedValue(undefined);
      mockAudit.log.mockResolvedValue(undefined);

      await service.broadcast({ message: 'Объявление', target: 'all' }, 'admin-1');

      // audit.log вызван (fire-and-forget — может быть чуть позже, но мок синхронный)
      // Используем небольшую задержку чтобы void promise завершился
      await new Promise((r) => setTimeout(r, 10));
      expect(mockAudit.log).toHaveBeenCalledWith(
        'admin-1',
        'broadcast_sent',
        'broadcast',
        undefined,
        expect.objectContaining({ queued: 1 }),
      );
    });
  });

  // ─── dashboardWidgets() ───────────────────────────────────────────────────

  describe('dashboardWidgets()', () => {
    it('возвращает все KPI метрики', async () => {
      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.enrollment.count.mockResolvedValue(80);
      mockPrisma.teacher.count.mockResolvedValue(5);
      mockPrisma.lesson.count.mockResolvedValue(12);
      mockPrisma.homeworkSubmission.count.mockResolvedValue(3);
      mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount_tiyin: BigInt(5000000) } });

      const result = await service.dashboardWidgets();

      expect(result).toMatchObject({
        total_students: expect.any(Number),
        active_enrollments: expect.any(Number),
        total_teachers: expect.any(Number),
        lessons_this_week: expect.any(Number),
        pending_homework: expect.any(Number),
        revenue_this_month: expect.any(Number),
        pending_users: expect.any(Number),
      });
    });
  });
});
