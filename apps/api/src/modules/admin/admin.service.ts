import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CEFR, ClassStatus, Role } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  async dashboardWidgets() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Week bounds (Mon–Sun)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Month bounds
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [
      totalStudents,
      activeEnrollments,
      totalTeachers,
      lessonsThisWeek,
      pendingHomework,
      revenueResult,
      pendingUsers,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.STUDENT } }),
      this.prisma.enrollment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.teacher.count(),
      this.prisma.lesson.count({
        where: { scheduled_at: { gte: weekStart, lt: weekEnd }, status: 'SCHEDULED' },
      }),
      this.prisma.homeworkSubmission.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.payment.aggregate({
        _sum: { amount_tiyin: true },
        where: { status: 'PAID', created_at: { gte: monthStart, lt: monthEnd } },
      }),
      this.prisma.user.count({ where: { is_active: false } }),
    ]);

    const revenueThisMonth = Number(revenueResult._sum.amount_tiyin ?? 0);

    return {
      total_students: totalStudents,
      active_enrollments: activeEnrollments,
      total_teachers: totalTeachers,
      lessons_this_week: lessonsThisWeek,
      pending_homework: pendingHomework,
      revenue_this_month: revenueThisMonth, // в тийинах
      pending_users: pendingUsers,
    };
  }

  // ─── Students ───────────────────────────────────────────────────────────────

  async listStudents(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = {
      role: Role.STUDENT,
      ...(search
        ? {
            OR: [
              { first_name: { contains: search, mode: 'insensitive' as const } },
              { last_name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { telegram_username: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          phone: true,
          telegram_username: true,
          avatar_url: true,
          locale: true,
          last_active_at: true,
          created_at: true,
          _count: { select: { enrollments: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async getStudent(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, role: Role.STUDENT },
      include: {
        enrollments: {
          include: { class: { select: { title: true, level: true } } },
          orderBy: { enrolled_at: 'desc' },
        },
      },
    });
    if (!user) throw new NotFoundException('Student not found');
    return { ...user, telegram_user_id: user.telegram_user_id.toString() };
  }

  async updateStudent(
    id: string,
    dto: { first_name?: string; last_name?: string; phone?: string; locale?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id, role: Role.STUDENT } });
    if (!user) throw new NotFoundException('Student not found');

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        phone: true,
        locale: true,
        updated_at: true,
      },
    });
  }

  async deleteStudent(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id, role: Role.STUDENT } });
    if (!user) throw new NotFoundException('Student not found');
    await this.prisma.user.delete({ where: { id } });
    void this.audit.log(actorId, 'student_deleted', 'user', id, {
      first_name: user.first_name,
      last_name: user.last_name,
    });
    return { ok: true };
  }

  // ─── Teachers ───────────────────────────────────────────────────────────────

  async listTeachers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.teacher.findMany({
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone: true,
              telegram_username: true,
              avatar_url: true,
              created_at: true,
            },
          },
          _count: { select: { classes: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.teacher.count(),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async createTeacher(
    dto: {
      first_name: string;
      last_name?: string;
      email: string;
      phone?: string;
      bio?: string;
    },
    actorId: string,
  ) {
    // Check email uniqueness
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already in use');

    // Create user with TEACHER role, then Teacher profile
    const user = await this.prisma.user.create({
      data: {
        telegram_user_id: BigInt(Date.now()), // placeholder — teacher logs in via admin
        first_name: dto.first_name,
        last_name: dto.last_name,
        email: dto.email,
        phone: dto.phone,
        role: Role.TEACHER,
      },
    });

    const teacher = await this.prisma.teacher.create({
      data: { user_id: user.id, bio: dto.bio },
      include: { user: { select: { id: true, first_name: true, last_name: true, email: true } } },
    });

    void this.audit.log(actorId, 'teacher_created', 'teacher', teacher.id, {
      email: dto.email,
      first_name: dto.first_name,
    });

    return teacher;
  }

  async updateTeacher(
    teacherId: string,
    dto: { bio?: string; photo_url?: string; first_name?: string; last_name?: string },
  ) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const { bio, photo_url, first_name, last_name } = dto;

    const [updatedTeacher] = await Promise.all([
      this.prisma.teacher.update({
        where: { id: teacherId },
        data: {
          ...(bio !== undefined ? { bio } : {}),
          ...(photo_url !== undefined ? { photo_url } : {}),
        },
        include: { user: { select: { id: true, first_name: true, last_name: true } } },
      }),
      first_name !== undefined || last_name !== undefined
        ? this.prisma.user.update({
            where: { id: teacher.user_id },
            data: {
              ...(first_name !== undefined ? { first_name } : {}),
              ...(last_name !== undefined ? { last_name } : {}),
            },
          })
        : Promise.resolve(),
    ]);

    return updatedTeacher;
  }

  async deleteTeacher(teacherId: string, actorId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: { select: { first_name: true, email: true } } },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const classCount = await this.prisma.class.count({ where: { teacher_id: teacherId } });
    if (classCount > 0) {
      throw new BadRequestException('Cannot delete teacher with active classes');
    }

    await this.prisma.teacher.delete({ where: { id: teacherId } });
    await this.prisma.user.delete({ where: { id: teacher.user_id } });

    void this.audit.log(actorId, 'teacher_deleted', 'teacher', teacherId, {
      first_name: teacher.user.first_name,
      email: teacher.user.email,
    });

    return { ok: true };
  }

  // ─── Classes ────────────────────────────────────────────────────────────────

  async listClasses(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.class.findMany({
        include: {
          language: { select: { id: true, name_ru: true, flag_emoji: true } },
          teacher: { include: { user: { select: { first_name: true, last_name: true } } } },
          _count: { select: { enrollments: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.class.count(),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async createClass(
    dto: {
      language_id: string;
      teacher_id: string;
      title: string;
      level: CEFR;
      price_uzs: number;
      price_usd?: number;
      max_students?: number;
      description?: string;
    },
    actorId: string,
  ) {
    const cls = await this.prisma.class.create({
      data: {
        language_id: dto.language_id,
        teacher_id: dto.teacher_id,
        title: dto.title,
        level: dto.level,
        price_uzs: dto.price_uzs,
        price_usd: dto.price_usd ?? 0,
        max_students: dto.max_students ?? 10,
        description: dto.description,
      },
      include: {
        language: { select: { name_ru: true, flag_emoji: true } },
        teacher: { include: { user: { select: { first_name: true, last_name: true } } } },
      },
    });

    void this.audit.log(actorId, 'class_created', 'class', cls.id, {
      title: dto.title,
      level: dto.level,
    });

    return cls;
  }

  async updateClass(
    classId: string,
    dto: {
      title?: string;
      level?: CEFR;
      price_uzs?: number;
      price_usd?: number;
      max_students?: number;
      description?: string;
      is_active?: boolean;
    },
  ) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    return this.prisma.class.update({ where: { id: classId }, data: dto });
  }

  async updateClassStatus(classId: string, status: ClassStatus) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    const updated = await this.prisma.class.update({
      where: { id: classId },
      data: {
        status,
        is_active: status === ClassStatus.ENROLLMENT_OPEN || status === ClassStatus.ACTIVE,
      },
    });
    return updated;
  }

  async deleteClass(classId: string, actorId: string) {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    const activeCount = await this.prisma.enrollment.count({
      where: { class_id: classId, status: 'ACTIVE' },
    });
    if (activeCount > 0) {
      throw new BadRequestException('Cannot delete class with active enrollments');
    }

    await this.prisma.class.delete({ where: { id: classId } });

    void this.audit.log(actorId, 'class_deleted', 'class', classId, { title: cls.title });

    return { ok: true };
  }

  // ─── Users / Roles ──────────────────────────────────────────────────────────

  async listUsers(page = 1, limit = 20, role?: Role, requesterRole?: Role) {
    const skip = (page - 1) * limit;
    const elevated: Role[] = [Role.ADMIN, Role.SUPER_ADMIN];
    // Менеджер не видит админов/супер-админов: фильтр роли всегда исключает их.
    const where: { role?: Role | { notIn: Role[] } } =
      requesterRole === Role.MANAGER
        ? { role: role && !elevated.includes(role) ? role : { notIn: elevated } }
        : role
          ? { role }
          : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          telegram_user_id: true,
          telegram_username: true,
          first_name: true,
          last_name: true,
          avatar_url: true,
          email: true,
          role: true,
          is_active: true,
          last_active_at: true,
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    // BigInt telegram_user_id → string (JSON.stringify не умеет BigInt)
    const mapped = items.map((u) => ({ ...u, telegram_user_id: u.telegram_user_id.toString() }));

    return { items: mapped, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * GET /admin/users/:id — полный профиль пользователя для детальной карточки.
   * Возвращает контактные данные + поля профиля, которые юзер заполнил сам.
   */
  async getUser(id: string, requesterRole?: Role) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        telegram_user_id: true,
        telegram_username: true,
        first_name: true,
        last_name: true,
        avatar_url: true,
        email: true,
        phone: true,
        gender: true,
        birth_date: true,
        locale: true,
        preferred_currency: true,
        country: true,
        role: true,
        is_active: true,
        created_at: true,
        last_active_at: true,
        _count: { select: { enrollments: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    // Менеджеру не показываем карточки админов/супер-админов.
    if (
      requesterRole === Role.MANAGER &&
      (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN)
    ) {
      throw new ForbiddenException('Недостаточно прав');
    }

    return {
      ...user,
      telegram_user_id: user.telegram_user_id.toString(),
      enrollments_count: user._count.enrollments,
    };
  }

  /**
   * PATCH /admin/users/:id/role
   * ADMIN не может выдавать ADMIN/SUPER_ADMIN (только SUPER_ADMIN может).
   */
  async changeRole(targetId: string, newRole: Role, requesterId: string, requesterRole: Role) {
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    // ADMIN cannot promote to ADMIN or SUPER_ADMIN
    if (requesterRole === Role.ADMIN && (newRole === Role.ADMIN || newRole === Role.SUPER_ADMIN)) {
      throw new ForbiddenException('ADMIN cannot assign ADMIN or SUPER_ADMIN role');
    }

    // Nobody can change SUPER_ADMIN except another SUPER_ADMIN
    if (target.role === Role.SUPER_ADMIN && requesterRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot change SUPER_ADMIN role');
    }

    const oldRole = target.role;

    // Increment token_version to invalidate existing tokens
    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { role: newRole, token_version: { increment: 1 } },
      select: { id: true, role: true, token_version: true },
    });

    void this.audit.log(requesterId, 'role_changed', 'user', targetId, {
      old_role: oldRole,
      new_role: newRole,
    });

    return updated;
  }

  // ─── Broadcast TG ───────────────────────────────────────────────────────────

  /**
   * POST /admin/notifications/broadcast
   * Отправляет Telegram-уведомление через BullMQ очередь.
   *
   * target:
   *   'all'     — всем студентам с ACTIVE enrollment
   *   classId   — студентам конкретного класса
   *
   * Лимит: 500 студентов за один запрос (защита от перегрузки TG API).
   * Реальные задания ставятся в очередь с задержкой — воркер шлёт по одному.
   */
  async broadcast(
    dto: { message: string; target: 'all' | string },
    actorId: string,
  ): Promise<{ queued: number }> {
    if (!dto.message?.trim()) {
      throw new BadRequestException('message is required');
    }

    // Получаем список студентов
    const where =
      dto.target === 'all'
        ? {
            role: Role.STUDENT,
            tg_blocked: false,
            enrollments: { some: { status: 'ACTIVE' as const } },
          }
        : {
            role: Role.STUDENT,
            tg_blocked: false,
            enrollments: { some: { status: 'ACTIVE' as const, class_id: dto.target } },
          };

    const students = await this.prisma.user.findMany({
      where,
      select: { id: true },
      take: 500,
    });

    // Ставим уведомление каждому в очередь
    for (const student of students) {
      void this.notifications.send({
        userId: student.id,
        type: NotificationType.BROADCAST,
        title: '📢 Объявление',
        body: dto.message,
        // Без dedupKey — broadcast может повторяться
      });
    }

    void this.audit.log(actorId, 'broadcast_sent', 'broadcast', undefined, {
      target: dto.target,
      message_preview: dto.message.slice(0, 100),
      queued: students.length,
    });

    return { queued: students.length };
  }

  // ─── Export CSV ──────────────────────────────────────────────────────────────

  /**
   * GET /admin/students/export
   * Возвращает CSV строку всех студентов.
   * Контроллер выставляет Content-Type: text/csv.
   */
  async exportStudentsCsv(): Promise<string> {
    const students = await this.prisma.user.findMany({
      where: { role: Role.STUDENT },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        telegram_username: true,
        locale: true,
        last_active_at: true,
        created_at: true,
        _count: { select: { enrollments: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const header =
      'id,first_name,last_name,email,phone,telegram_username,locale,enrollments,last_active_at,created_at';
    const rows = students.map((s) =>
      [
        s.id,
        this.csvEscape(s.first_name),
        this.csvEscape(s.last_name ?? ''),
        this.csvEscape(s.email ?? ''),
        this.csvEscape(s.phone ?? ''),
        this.csvEscape(s.telegram_username ?? ''),
        s.locale,
        s._count.enrollments,
        s.last_active_at?.toISOString() ?? '',
        s.created_at.toISOString(),
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  /**
   * GET /admin/payments/export
   * Возвращает CSV строку всех платежей.
   */
  async exportPaymentsCsv(): Promise<string> {
    const payments = await this.prisma.payment.findMany({
      select: {
        id: true,
        amount_tiyin: true,
        status: true,
        provider: true,
        created_at: true,
        paid_at: true,
        class_id: true,
        // user = студент-плательщик
        user: {
          select: { id: true, first_name: true, last_name: true, email: true },
        },
        // class — через class_id (прямая связь в Payment)
        class: { select: { title: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const header =
      'id,student_id,student_name,email,class,amount_uzs,provider,status,paid_at,created_at';
    const rows = payments.map((p) => {
      // amount_tiyin — BigInt, конвертируем через Number (max 2^53 - достаточно для UZS)
      const amountUzs = Math.round(Number(p.amount_tiyin) / 100); // тийин → сум
      return [
        p.id,
        p.user.id,
        this.csvEscape(`${p.user.first_name} ${p.user.last_name ?? ''}`.trim()),
        this.csvEscape(p.user.email ?? ''),
        this.csvEscape(p.class?.title ?? ''),
        amountUzs,
        p.provider,
        p.status,
        p.paid_at?.toISOString() ?? '',
        p.created_at.toISOString(),
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  /** Экранирование поля CSV: если содержит запятую или кавычки — оборачиваем в "..." */
  private csvEscape(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // ─── Settings (PaymentProviderConfig) ────────────────────────────────────────

  /** GET /admin/settings/payment-providers */
  async listPaymentProviders() {
    return this.prisma.paymentProviderConfig.findMany({
      orderBy: { display_order: 'asc' },
    });
  }

  /**
   * PATCH /admin/settings/payment-providers/:provider
   * Обновляет is_enabled, display_order, config (merge).
   */
  async updatePaymentProvider(
    provider: string,
    dto: { is_enabled?: boolean; display_order?: number; config?: Record<string, unknown> },
    actorId: string,
  ) {
    const existing = await this.prisma.paymentProviderConfig.findUnique({
      where: { provider: provider as any },
    });
    if (!existing) throw new NotFoundException(`Provider ${provider} not found`);

    const oldEnabled = existing.is_enabled;

    const updated = await this.prisma.paymentProviderConfig.update({
      where: { provider: provider as any },
      data: {
        ...(dto.is_enabled !== undefined ? { is_enabled: dto.is_enabled } : {}),
        ...(dto.display_order !== undefined ? { display_order: dto.display_order } : {}),
        ...(dto.config !== undefined
          ? {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
              config: {
                ...(existing.config as Record<string, unknown>),
                ...dto.config,
              } as any,
            }
          : {}),
      },
    });

    void this.audit.log(actorId, 'settings_updated', 'payment_provider', provider, {
      old_enabled: oldEnabled,
      new_enabled: dto.is_enabled,
      display_order: dto.display_order,
    });

    return updated;
  }

  // ─── Analytics ───────────────────────────────────────────────────────────────

  /**
   * GET /admin/analytics/revenue
   * Выручка по месяцам за последние N месяцев (только PAID платежи).
   * Возвращает массив { month: 'YYYY-MM', amount_uzs: number }.
   *
   * Используем сырой SQL через prisma.$queryRaw для GROUP BY DATE_TRUNC —
   * Prisma ORM не поддерживает GROUP BY date functions нативно.
   */
  async analyticsRevenue(months = 12): Promise<{ month: string; amount_uzs: number }[]> {
    if (months < 1 || months > 36) throw new BadRequestException('months must be between 1 and 36');
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    // date_trunc('month', paid_at) → YYYY-MM-01T00:00:00Z
    // to_char(...) → 'YYYY-MM'
    const rows = await this.prisma.$queryRaw<{ month: string; amount_uzs: bigint }[]>`
      SELECT
        to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month,
        SUM(amount_tiyin) / 100                          AS amount_uzs
      FROM "Payment"
      WHERE status = 'PAID'
        AND paid_at >= ${since}
      GROUP BY date_trunc('month', paid_at)
      ORDER BY month ASC
    `;

    // BigInt → number (безопасно для суммы в UZS)
    return rows.map((r) => ({
      month: r.month,
      amount_uzs: Number(r.amount_uzs),
    }));
  }

  /**
   * GET /admin/analytics/students
   * Новые студенты по месяцам за последние N месяцев.
   * Возвращает массив { month: 'YYYY-MM', count: number }.
   */
  async analyticsStudents(months = 12): Promise<{ month: string; count: number }[]> {
    if (months < 1 || months > 36) throw new BadRequestException('months must be between 1 and 36');
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)                                             AS count
      FROM "User"
      WHERE role = 'STUDENT'
        AND created_at >= ${since}
      GROUP BY date_trunc('month', created_at)
      ORDER BY month ASC
    `;

    return rows.map((r) => ({
      month: r.month,
      count: Number(r.count),
    }));
  }

  /**
   * GET /admin/analytics/enrollments
   * Воронка записей: кол-во PENDING, ACTIVE, DROPPED всего и за текущий месяц.
   * Возвращает { total, current_month, by_status }.
   */
  async analyticsEnrollments(): Promise<{
    funnel: { pending: number; active: number; dropped: number };
    by_month: { month: string; count: number }[];
  }> {
    // Totals по статусам
    const byStatus = await this.prisma.enrollment.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const funnel = { pending: 0, active: 0, dropped: 0 };
    for (const s of byStatus) {
      if (s.status === 'PENDING') funnel.pending = s._count.status;
      else if (s.status === 'ACTIVE') funnel.active = s._count.status;
      else if (s.status === 'DROPPED') funnel.dropped = s._count.status;
    }

    // Помесячно за последние 6 месяцев (все статусы, total count)
    const since = new Date();
    since.setMonth(since.getMonth() - 6);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<{ month: string; count: bigint }[]>`
      SELECT
        to_char(date_trunc('month', enrolled_at), 'YYYY-MM') AS month,
        COUNT(*) AS count
      FROM "Enrollment"
      WHERE enrolled_at >= ${since}
      GROUP BY date_trunc('month', enrolled_at)
      ORDER BY month ASC
    `;

    return {
      funnel,
      by_month: rows.map((r) => ({ month: r.month, count: Number(r.count) })),
    };
  }
}
