import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EnrollmentMaintenanceService {
  private readonly logger = new Logger(EnrollmentMaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Ежедневно в 01:00 UTC — истекшие trial-записи → DROPPED.
   * trial_expires_at < NOW() AND is_trial = true AND status IN (ACTIVE, PENDING)
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireTrials(): Promise<void> {
    const now = new Date();

    const expired = await this.prisma.enrollment.findMany({
      where: {
        is_trial: true,
        status: { in: ['ACTIVE', 'PENDING'] },
        trial_expires_at: { lt: now },
      },
      select: {
        id: true,
        student_id: true,
        class_id: true,
        class: { select: { title: true } } as { select: { title: boolean } },
      },
    });

    if (expired.length === 0) return;

    this.logger.log(`Expiring ${expired.length} trial enrollment(s)`);

    await this.prisma.enrollment.updateMany({
      where: { id: { in: expired.map((e) => e.id) } },
      data: { status: 'DROPPED' },
    });

    for (const e of expired) {
      void this.notifications.scheduleEnrollmentDropped(e.student_id, e.class.title, e.id);
    }
  }
}
