/**
 * AuditService — централизованная запись административных действий.
 *
 * Логируемые события (action):
 *   role_changed        — смена роли пользователя
 *   student_deleted     — удаление студента
 *   teacher_created     — создание учителя
 *   teacher_deleted     — удаление учителя
 *   class_created       — создание класса
 *   class_deleted       — удаление класса
 *   broadcast_sent      — массовая рассылка TG
 *   payment_refunded    — возврат оплаты
 *   settings_updated    — изменение настроек провайдеров оплаты
 *
 * Метаданные (meta) — свободный JSON: old_value, new_value, reason и т.д.
 *
 * Вызывается из AdminService (fire-and-forget через void).
 * Ошибки логируются, но не пробрасываются — аудит не должен ломать основной поток.
 */
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Записывает событие в audit_log.
   * @param actorId  — id пользователя-исполнителя
   * @param action   — snake_case действие (role_changed, student_deleted, ...)
   * @param entityType — тип сущности ('user', 'class', 'teacher', ...)
   * @param entityId — id сущности (необязательно для broadcast)
   * @param meta     — дополнительные данные (old value, new value, etc.)
   */
  async log(
    actorId: string,
    action: string,
    entityType: string,
    entityId?: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actor_id: actorId,
          action,
          entity_type: entityType,
          entity_id: entityId ?? null,
          meta: (meta ?? {}) as object,
        },
      });
    } catch (err) {
      // Аудит не должен ломать основной поток
      this.logger.error(`AuditLog failed: action=${action} actor=${actorId}: ${String(err)}`);
    }
  }

  /**
   * Список событий аудита с пагинацией и фильтрацией.
   * Используется в GET /admin/audit.
   */
  async list(opts: {
    page?: number;
    limit?: number;
    actorId?: string;
    action?: string;
    entityType?: string;
  }) {
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      ...(opts.actorId ? { actor_id: opts.actorId } : {}),
      ...(opts.action ? { action: opts.action } : {}),
      ...(opts.entityType ? { entity_type: opts.entityType } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, first_name: true, last_name: true, role: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }
}
