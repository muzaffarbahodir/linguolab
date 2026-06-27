import { BadRequestException } from '@nestjs/common';
import { ClassStatus } from '@prisma/client';

/**
 * Стейт-машина статуса класса (семестра).
 *
 * Портировано из flowershop `order_service.advance_status` — валидируемые
 * переходы вместо произвольной смены статуса. Не даёт «воскресить» завершённый
 * или отменённый класс и пропустить этапы жизненного цикла.
 *
 * Терминальные статусы (COMPLETED, CANCELLED) переходов не имеют.
 */
export const CLASS_STATUS_TRANSITIONS: Record<ClassStatus, ClassStatus[]> = {
  [ClassStatus.DRAFT]: [ClassStatus.ENROLLMENT_OPEN, ClassStatus.CANCELLED],
  [ClassStatus.ENROLLMENT_OPEN]: [ClassStatus.ACTIVE, ClassStatus.CANCELLED],
  [ClassStatus.ACTIVE]: [ClassStatus.EXAM, ClassStatus.COMPLETED, ClassStatus.CANCELLED],
  [ClassStatus.EXAM]: [ClassStatus.COMPLETED, ClassStatus.CANCELLED],
  [ClassStatus.COMPLETED]: [],
  [ClassStatus.CANCELLED]: [],
};

/**
 * Проверяет допустимость перехода from → to. Бросает BadRequest, если нельзя.
 * Повтор того же статуса считается идемпотентным no-op (не ошибка).
 */
export function assertClassTransition(from: ClassStatus, to: ClassStatus): void {
  if (from === to) return;
  const allowed = CLASS_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(`Недопустимый переход статуса класса: ${from} → ${to}`);
  }
}
