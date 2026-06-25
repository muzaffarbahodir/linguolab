/**
 * Unit-тесты для AuditService.
 *
 * Стратегия:
 *  - PrismaService мокируем через jest.mock — реальная БД не нужна.
 *  - Проверяем: log() создаёт запись с правильными аргументами.
 *  - Проверяем: ошибка Prisma НЕ пробрасывается (fire-and-forget).
 *  - Проверяем: list() передаёт правильные where/skip/take.
 */
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../audit.service';

// ─── Мок PrismaService ────────────────────────────────────────────────────────

const mockAuditLogCreate = jest.fn();
const mockAuditLogFindMany = jest.fn();
const mockAuditLogCount = jest.fn();

const mockPrisma = {
  auditLog: {
    create: mockAuditLogCreate,
    findMany: mockAuditLogFindMany,
    count: mockAuditLogCount,
  },
};

// ─── Тесты ────────────────────────────────────────────────────────────────────

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  // ─── log() ──────────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('создаёт запись в БД с корректными аргументами', async () => {
      mockAuditLogCreate.mockResolvedValueOnce({ id: 'audit-1' });

      await service.log('actor-123', 'role_changed', 'user', 'user-456', {
        old_role: 'STUDENT',
        new_role: 'TEACHER',
      });

      expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: {
          actor_id: 'actor-123',
          action: 'role_changed',
          entity_type: 'user',
          entity_id: 'user-456',
          meta: { old_role: 'STUDENT', new_role: 'TEACHER' },
        },
      });
    });

    it('entity_id = null если не передан', async () => {
      mockAuditLogCreate.mockResolvedValueOnce({ id: 'audit-2' });

      await service.log('actor-123', 'broadcast_sent', 'broadcast');

      expect(mockAuditLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ entity_id: null, meta: {} }),
      });
    });

    it('НЕ пробрасывает ошибку Prisma (fire-and-forget)', async () => {
      mockAuditLogCreate.mockRejectedValueOnce(new Error('DB connection lost'));

      // Не должен бросить — ошибка поглощается внутри
      await expect(service.log('actor-1', 'test_action', 'test')).resolves.toBeUndefined();
    });
  });

  // ─── list() ─────────────────────────────────────────────────────────────────

  describe('list()', () => {
    const mockItems = [
      { id: '1', action: 'role_changed', actor: { first_name: 'Admin' } },
      { id: '2', action: 'student_deleted', actor: { first_name: 'Admin' } },
    ];

    beforeEach(() => {
      mockAuditLogFindMany.mockResolvedValue(mockItems);
      mockAuditLogCount.mockResolvedValue(2);
    });

    it('возвращает items, total, page, pages', async () => {
      const result = await service.list({ page: 1, limit: 10 });

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
    });

    it('правильно вычисляет skip по page/limit', async () => {
      await service.list({ page: 3, limit: 50 });

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 100, take: 50 }),
      );
    });

    it('передаёт фильтры actorId, action, entityType', async () => {
      await service.list({ actorId: 'u1', action: 'role_changed', entityType: 'user' });

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { actor_id: 'u1', action: 'role_changed', entity_type: 'user' },
        }),
      );
    });

    it('пустой where если фильтры не переданы', async () => {
      await service.list({});

      expect(mockAuditLogFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });

    it('pages рассчитывается корректно (ceil)', async () => {
      mockAuditLogCount.mockResolvedValueOnce(51);
      const result = await service.list({ limit: 50 });
      expect(result.pages).toBe(2); // Math.ceil(51/50) = 2
    });
  });
});
