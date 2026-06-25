import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { TeachersService } from '../teachers/teachers.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AnalyticsService } from '../analytics/analytics.service';

/** Общий select для полных данных записи */
const enrollmentFullSelect = {
  id: true,
  status: true,
  enrolled_at: true,
  student: {
    select: {
      id: true,
      first_name: true,
      last_name: true,
      telegram_username: true,
      // telegram_user_id (BigInt) НЕ включаем — JSON.stringify его не умеет → 500
    },
  },
  class: {
    select: {
      id: true,
      title: true,
      level: true,
      price_uzs: true,
      description: true,
      max_students: true,
      // telegram_chat_id (BigInt) НЕ включаем — ломает JSON-сериализацию
      schedule_days: true,
      schedule_time: true,
      schedule_duration: true,
      language: {
        select: {
          id: true,
          name_ru: true,
          flag_emoji: true,
          color: true,
        },
      },
      teacher: {
        select: {
          id: true,
          user: {
            select: {
              first_name: true,
              last_name: true,
              avatar_url: true,
            },
          },
        },
      },
    },
  },
} as const;

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
    private readonly teachers: TeachersService,
    private readonly notifications: NotificationsService,
    private readonly analytics: AnalyticsService,
  ) {}

  /** GET /enrollments/my — список записей текущего студента */
  findMy(studentId: string) {
    return this.prisma.enrollment.findMany({
      where: {
        student_id: studentId,
        status: { in: ['ACTIVE', 'PENDING'] },
      },
      select: enrollmentFullSelect,
      orderBy: { enrolled_at: 'desc' },
    });
  }

  /**
   * GET /enrollments — все записи для менеджера.
   * Фильтр по статусу (опционально).
   */
  findAll(status?: EnrollmentStatus) {
    return this.prisma.enrollment.findMany({
      where: status ? { status } : {},
      select: enrollmentFullSelect,
      orderBy: [{ status: 'asc' }, { enrolled_at: 'desc' }],
    });
  }

  /**
   * PATCH /enrollments/:id/status — менеджер одобряет/отклоняет запись.
   * При DROPPED: автоматически промотирует первого из WAITLIST → PENDING.
   */
  async updateStatus(enrollmentId: string, status: 'ACTIVE' | 'DROPPED') {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: {
        id: true,
        status: true,
        student_id: true,
        class_id: true,
        student: { select: { telegram_user_id: true } },
        class: {
          select: {
            title: true,
            telegram_chat_id: true,
          },
        },
      },
    });

    if (!enrollment) throw new NotFoundException('Enrollment not found');

    const updated = await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status },
      select: { id: true, status: true, enrolled_at: true },
    });

    void this.analytics.track('enroll', {
      userId: enrollment.student_id,
      userRole: 'STUDENT',
      entityId: enrollmentId,
      entityType: 'enrollment',
      properties: { status, class_title: enrollment.class.title },
    });

    if (status === 'ACTIVE') {
      if (enrollment.class.telegram_chat_id) {
        void this.telegram.sendGroupInvite(
          enrollment.student.telegram_user_id,
          enrollment.class.telegram_chat_id,
          enrollment.class.title,
        );
      }
      void this.notifications.scheduleEnrollmentConfirmed(
        enrollment.student_id,
        enrollment.class.title,
        enrollmentId,
      );
    }

    if (status === 'DROPPED') {
      void this.notifications.scheduleEnrollmentDropped(
        enrollment.student_id,
        enrollment.class.title,
        enrollmentId,
      );
      // Автоматически промотируем первого из WAITLIST → PENDING
      void this.promoteWaitlist(enrollment.class_id, enrollment.class.title);
    }

    return updated;
  }

  /**
   * Промотирует первого в очереди ожидания (WAITLIST → PENDING).
   * Вызывается после каждого DROPPED — освободилось место.
   */
  async promoteWaitlist(classId: string, classTitle: string): Promise<void> {
    const next = await this.prisma.enrollment.findFirst({
      where: { class_id: classId, status: 'WAITLIST' },
      orderBy: { enrolled_at: 'asc' },
    });
    if (!next) return;

    await this.prisma.enrollment.update({
      where: { id: next.id },
      data: { status: 'PENDING' },
    });

    void this.notifications.scheduleEnrollmentConfirmed(next.student_id, classTitle, next.id);
  }

  // ─── Transfer requests ───────────────────────────────────────────────────

  /**
   * POST /enrollments/transfer — студент запрашивает перевод из класса в класс.
   * Body: { from_class_id, to_class_id, reason? }
   * Автоматически вычисляет fee (10% if target teacher rated higher).
   */
  async requestTransfer(
    studentId: string,
    fromClassId: string,
    toClassId: string,
    reason?: string,
  ) {
    // Убедимся что студент активно записан в from_class
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: fromClassId } },
    });
    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new BadRequestException('You are not actively enrolled in the source class');
    }

    // to_class должен существовать и быть активным
    const toClass = await this.prisma.class.findUnique({
      where: { id: toClassId },
      select: {
        id: true,
        is_active: true,
        max_students: true,
        _count: { select: { enrollments: { where: { status: { in: ['ACTIVE', 'PENDING'] } } } } },
      },
    });
    if (!toClass || !toClass.is_active) {
      throw new BadRequestException('Target class not found or inactive');
    }

    // Уже записан в to_class?
    const alreadyEnrolled = await this.prisma.enrollment.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: toClassId } },
    });
    if (alreadyEnrolled) {
      throw new BadRequestException('Already enrolled in target class');
    }

    // Нет ли уже активного запроса на перевод?
    const existingTransfer = await this.prisma.classTransferRequest.findFirst({
      where: { student_id: studentId, from_class_id: fromClassId, status: 'PENDING' },
    });
    if (existingTransfer) {
      throw new BadRequestException('You already have a pending transfer request from this class');
    }

    // Вычисляем fee
    const fee_uzs = await this.teachers.computeTransferFee(fromClassId, toClassId);

    const transfer = await this.prisma.classTransferRequest.create({
      data: {
        student_id: studentId,
        from_class_id: fromClassId,
        to_class_id: toClassId,
        fee_uzs,
        reason,
      },
      select: {
        id: true,
        status: true,
        fee_uzs: true,
        reason: true,
        created_at: true,
        from_class: { select: { id: true, title: true } },
        to_class: { select: { id: true, title: true } },
        student: { select: { first_name: true, last_name: true } },
      },
    });

    const who = `${transfer.student.first_name}${transfer.student.last_name ? ' ' + transfer.student.last_name : ''}`;
    void this.notifications.notifyStaffNewRequest(
      '🔄 Запрос на перевод',
      `${who}: ${transfer.from_class.title} → ${transfer.to_class.title}`,
      `transfer:${transfer.id}`,
    );

    return transfer;
  }

  /**
   * GET /enrollments/transfer/my — список запросов студента.
   */
  findMyTransfers(studentId: string) {
    return this.prisma.classTransferRequest.findMany({
      where: { student_id: studentId },
      select: {
        id: true,
        status: true,
        fee_uzs: true,
        reason: true,
        admin_note: true,
        created_at: true,
        updated_at: true,
        from_class: {
          select: {
            id: true,
            title: true,
            language: { select: { flag_emoji: true, name_ru: true } },
          },
        },
        to_class: {
          select: {
            id: true,
            title: true,
            language: { select: { flag_emoji: true, name_ru: true } },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * GET /enrollments/transfer — все запросы (менеджер).
   */
  findAllTransfers(status?: string) {
    return this.prisma.classTransferRequest.findMany({
      where: status ? { status: status as never } : {},
      select: {
        id: true,
        status: true,
        fee_uzs: true,
        reason: true,
        admin_note: true,
        created_at: true,
        student: {
          select: { id: true, first_name: true, last_name: true, telegram_username: true },
        },
        from_class: { select: { id: true, title: true } },
        to_class: {
          select: {
            id: true,
            title: true,
            max_students: true,
            _count: {
              select: { enrollments: { where: { status: { in: ['ACTIVE', 'PENDING'] } } } },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    });
  }

  /**
   * PATCH /enrollments/transfer/:id/cancel — студент отменяет запрос.
   */
  async cancelTransfer(transferId: string, studentId: string) {
    const transfer = await this.prisma.classTransferRequest.findUnique({
      where: { id: transferId },
    });
    if (!transfer) throw new NotFoundException('Transfer request not found');
    if (transfer.student_id !== studentId) throw new ForbiddenException();
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Can only cancel PENDING requests');
    }

    return this.prisma.classTransferRequest.update({
      where: { id: transferId },
      data: { status: 'CANCELLED', updated_at: new Date() },
      select: { id: true, status: true },
    });
  }

  /**
   * PATCH /enrollments/transfer/:id/approve — менеджер одобряет перевод.
   * Выполняет фактический перевод: DROPPED из from_class, ACTIVE в to_class.
   */
  async approveTransfer(transferId: string, adminNote?: string) {
    const transfer = await this.prisma.classTransferRequest.findUnique({
      where: { id: transferId },
      include: {
        to_class: {
          select: {
            id: true,
            max_students: true,
            telegram_chat_id: true,
            title: true,
            _count: {
              select: { enrollments: { where: { status: { in: ['ACTIVE', 'PENDING'] } } } },
            },
          },
        },
        student: { select: { id: true, telegram_user_id: true } },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer request not found');
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Can only approve PENDING requests');
    }

    // Проверяем что в to_class есть место (учитываем WAITLIST как обход)
    if (transfer.to_class._count.enrollments >= transfer.to_class.max_students) {
      throw new BadRequestException('Target class is full');
    }

    // Транзакция: drop from_class, activate to_class
    await this.prisma.$transaction([
      this.prisma.enrollment.update({
        where: {
          student_id_class_id: {
            student_id: transfer.student_id,
            class_id: transfer.from_class_id,
          },
        },
        data: { status: 'DROPPED' },
      }),
      this.prisma.enrollment.upsert({
        where: {
          student_id_class_id: {
            student_id: transfer.student_id,
            class_id: transfer.to_class_id,
          },
        },
        update: { status: 'ACTIVE' },
        create: {
          student_id: transfer.student_id,
          class_id: transfer.to_class_id,
          status: 'ACTIVE',
        },
      }),
      this.prisma.classTransferRequest.update({
        where: { id: transferId },
        data: { status: 'APPROVED', admin_note: adminNote, updated_at: new Date() },
      }),
    ]);

    // Уведомляем в Telegram-группе нового класса
    if (transfer.to_class.telegram_chat_id) {
      void this.telegram.sendGroupInvite(
        transfer.student.telegram_user_id,
        transfer.to_class.telegram_chat_id,
        transfer.to_class.title,
      );
    }

    // Освободилось место в from_class — промотируем из waitlist
    const fromClass = await this.prisma.class.findUnique({
      where: { id: transfer.from_class_id },
      select: { title: true },
    });
    if (fromClass) {
      void this.promoteWaitlist(transfer.from_class_id, fromClass.title);
    }

    return { id: transferId, status: 'APPROVED' };
  }

  /**
   * PATCH /enrollments/transfer/:id/reject — менеджер отклоняет.
   */
  async rejectTransfer(transferId: string, adminNote?: string) {
    const transfer = await this.prisma.classTransferRequest.findUnique({
      where: { id: transferId },
    });
    if (!transfer) throw new NotFoundException('Transfer request not found');
    if (transfer.status !== 'PENDING') {
      throw new BadRequestException('Can only reject PENDING requests');
    }

    return this.prisma.classTransferRequest.update({
      where: { id: transferId },
      data: { status: 'REJECTED', admin_note: adminNote, updated_at: new Date() },
      select: { id: true, status: true, admin_note: true },
    });
  }
}
