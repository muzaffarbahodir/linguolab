import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClassStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { LessonsService } from '../lessons/lessons.service';

/**
 * ClassLifecycleService — автоматические переходы статусов семестра.
 *
 * Каждые 15 минут проверяет классы и переводит их в нужный статус
 * на основе enrollment_opens_at / starts_at / ends_at.
 *
 * Timeline:
 *   enrollment_opens_at  → ENROLLMENT_OPEN  (is_active = true, студенты видят)
 *   enrollment_closes_at → ACTIVE (запись закрыта, занятия начинаются)
 *   starts_at            → ACTIVE (если enrollment_closes_at не задан)
 *   ends_at              → COMPLETED (семестр завершён)
 */
@Injectable()
export class ClassLifecycleService {
  private readonly logger = new Logger(ClassLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly lessons: LessonsService,
  ) {}

  @Cron('*/15 * * * *')
  async tick(): Promise<void> {
    const now = new Date();
    await Promise.all([
      this.openEnrollment(now),
      this.activateClasses(now),
      this.completeClasses(now),
    ]);
  }

  /** DRAFT → ENROLLMENT_OPEN: enrollment_opens_at ≤ now */
  private async openEnrollment(now: Date): Promise<void> {
    const { count } = await this.prisma.class.updateMany({
      where: {
        status: ClassStatus.DRAFT,
        enrollment_opens_at: { lte: now },
      },
      data: { status: ClassStatus.ENROLLMENT_OPEN, is_active: true },
    });
    if (count > 0) this.logger.log(`Opened enrollment for ${count} class(es)`);
  }

  /**
   * ENROLLMENT_OPEN → ACTIVE:
   *   enrollment_closes_at ≤ now  (запись закрылась)
   *   OR starts_at ≤ now (и enrollment_closes_at не задан)
   *
   * При активации авто-генерируем уроки по расписанию класса (B1) — раньше это
   * приходилось делать учителю вручную; забыл → пустое расписание, нет посещаемости,
   * не открывается гейт оценки, зарплата PER_LESSON = 0.
   */
  private async activateClasses(now: Date): Promise<void> {
    const toActivate = await this.prisma.class.findMany({
      where: {
        status: ClassStatus.ENROLLMENT_OPEN,
        OR: [
          { enrollment_closes_at: { lte: now } },
          { starts_at: { lte: now }, enrollment_closes_at: null },
        ],
      },
      select: { id: true, title: true },
    });
    if (toActivate.length === 0) return;

    await this.prisma.class.updateMany({
      where: { id: { in: toActivate.map((c) => c.id) } },
      data: { status: ClassStatus.ACTIVE },
    });
    this.logger.log(`Activated ${toActivate.length} class(es)`);

    // Авто-генерация уроков (идемпотентно; молча пропускает классы без расписания).
    for (const c of toActivate) {
      try {
        const { created } = await this.lessons.generateLessonsForClass(c.id);
        if (created > 0) this.logger.log(`Auto-generated ${created} lesson(s) for "${c.title}"`);
      } catch (err) {
        this.logger.error(`Lesson auto-gen failed for class ${c.id}: ${String(err)}`);
      }
    }
  }

  /** ACTIVE → COMPLETED: ends_at ≤ now */
  private async completeClasses(now: Date): Promise<void> {
    const { count } = await this.prisma.class.updateMany({
      where: {
        status: { in: [ClassStatus.ACTIVE, ClassStatus.EXAM] },
        ends_at: { lte: now },
      },
      data: { status: ClassStatus.COMPLETED, is_active: false },
    });
    if (count > 0) this.logger.log(`Completed ${count} class(es)`);
  }
}
