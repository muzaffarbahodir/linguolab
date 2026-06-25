import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/** Roles that cannot be self-assigned through the admin activate endpoint */
const PROTECTED_ROLES: Role[] = [Role.SUPER_ADMIN];

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        telegram_user_id: true,
        telegram_username: true,
        first_name: true,
        last_name: true,
        avatar_url: true,
        role: true,
        is_active: true,
        locale: true,
        preferred_currency: true,
        timezone: true,
        gender: true,
        birth_date: true,
        last_active_at: true,
        created_at: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return { ...user, telegram_user_id: user.telegram_user_id.toString() };
  }

  /**
   * PATCH /users/me — обновить профиль.
   * Разрешённые поля: first_name, last_name, locale, timezone, avatar_url.
   */
  async updateMe(
    userId: string,
    dto: {
      first_name?: string;
      last_name?: string;
      locale?: string;
      preferred_currency?: string;
      timezone?: string;
      avatar_url?: string;
      gender?: 'MALE' | 'FEMALE' | null;
      birth_date?: string | null;
    },
  ) {
    if (dto.preferred_currency && !['UZS', 'USD'].includes(dto.preferred_currency)) {
      dto.preferred_currency = undefined;
    }
    // gender: только MALE/FEMALE или null (сброс)
    let gender: 'MALE' | 'FEMALE' | null | undefined = dto.gender;
    if (gender !== undefined && gender !== null && !['MALE', 'FEMALE'].includes(gender)) {
      gender = undefined;
    }
    // birth_date: ISO-строка → Date, или null (сброс). Не в будущем, разумный диапазон.
    let birthDate: Date | null | undefined;
    if (dto.birth_date === null) {
      birthDate = null;
    } else if (typeof dto.birth_date === 'string') {
      const d = new Date(dto.birth_date);
      const year = d.getUTCFullYear();
      if (!isNaN(d.getTime()) && d.getTime() <= Date.now() && year >= 1920) {
        birthDate = d;
      } else {
        throw new BadRequestException('Invalid birth_date');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        first_name: dto.first_name,
        last_name: dto.last_name,
        locale: dto.locale,
        preferred_currency: dto.preferred_currency,
        timezone: dto.timezone,
        avatar_url: dto.avatar_url,
        gender,
        birth_date: birthDate,
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        avatar_url: true,
        locale: true,
        preferred_currency: true,
        timezone: true,
        gender: true,
        birth_date: true,
        updated_at: true,
      },
    });
    return user;
  }

  /**
   * GET /users/me/progress — прогресс студента.
   * Возвращает: активные записи, ближайший урок, статистику ДЗ.
   */
  async getProgress(userId: string) {
    const [enrollments, homeworkStats, achievements, placementTest] = await Promise.all([
      // Активные записи с классами
      this.prisma.enrollment.findMany({
        where: { student_id: userId, status: 'ACTIVE' },
        include: {
          class: {
            select: {
              title: true,
              level: true,
              language: { select: { name_ru: true, flag_emoji: true, color: true } },
            },
          },
        },
      }),
      // Статистика ДЗ
      this.prisma.homeworkSubmission.groupBy({
        by: ['status'],
        where: { student_id: userId },
        _count: true,
      }),
      // Достижения
      this.prisma.userAchievement.count({ where: { user_id: userId } }),
      // Последний placement test
      this.prisma.placementTest.findFirst({
        where: { user_id: userId, status: 'COMPLETED' },
        orderBy: { completed_at: 'desc' },
        select: { level_assigned: true, score: true, completed_at: true },
      }),
    ]);

    const hwByStatus = Object.fromEntries(homeworkStats.map((s) => [s.status, s._count]));

    return {
      active_enrollments: enrollments.length,
      classes: enrollments.map((e) => ({
        class_title: e.class.title,
        level: e.class.level,
        language: e.class.language,
        enrolled_at: e.enrolled_at,
      })),
      homework: {
        submitted: hwByStatus['SUBMITTED'] ?? 0,
        graded: hwByStatus['GRADED'] ?? 0,
        total: Object.values(hwByStatus).reduce((a, b) => a + b, 0),
      },
      achievements_count: achievements,
      placement_test: placementTest ?? null,
    };
  }

  /**
   * GET /users/me/stats — детальная статистика студента.
   * lessons_attended: посещённые уроки (PRESENT + LATE)
   * streak_days: текущая серия посещений (дни подряд)
   * avg_grade: средняя оценка по проверенным ДЗ
   */
  async getStudentStats(userId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { student_id: userId, status: 'ACTIVE' },
      select: { class_id: true },
    });
    const classIds = enrollments.map((e) => e.class_id);

    const [attendanceRows, gradedSubmissions, totalLessons] = await Promise.all([
      // Все записи посещаемости студента в его классах
      this.prisma.lessonAttendance.findMany({
        where: {
          student_id: userId,
          status: { in: ['PRESENT', 'LATE'] },
          lesson: classIds.length ? { class_id: { in: classIds } } : undefined,
        },
        select: { lesson: { select: { scheduled_at: true } } },
        orderBy: { lesson: { scheduled_at: 'desc' } },
      }),
      // Оценки по ДЗ
      this.prisma.homeworkSubmission.findMany({
        where: { student_id: userId, status: 'GRADED', grade: { not: null } },
        select: { grade: true },
      }),
      // Всего завершённых уроков в классах студента
      classIds.length
        ? this.prisma.lesson.count({
            where: { class_id: { in: classIds }, status: 'COMPLETED' },
          })
        : Promise.resolve(0),
    ]);

    // Стрик: считаем сколько дней подряд (UTC) есть хотя бы одно посещение
    const attendedDays = new Set(
      attendanceRows.map((r) => r.lesson.scheduled_at.toISOString().slice(0, 10)),
    );
    let streak = 0;
    const todayUtc = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(todayUtc);
      d.setUTCDate(todayUtc.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (attendedDays.has(key)) {
        streak++;
      } else if (i > 0) {
        break; // серия прервана
      }
    }

    const avgGrade =
      gradedSubmissions.length > 0
        ? Math.round(
            gradedSubmissions.reduce((s, r) => s + (r.grade ?? 0), 0) / gradedSubmissions.length,
          )
        : null;

    return {
      lessons_attended: attendanceRows.length,
      lessons_total: totalLessons,
      streak_days: streak,
      avg_grade: avgGrade,
    };
  }

  /**
   * GET /users/me/lessons/recent — последние занятия студента (как «история матчей»).
   * Берём записи посещаемости студента, свежие сверху. Тема, дата, статус, класс+язык.
   */
  async getRecentLessons(userId: string, limit = 6) {
    const rows = await this.prisma.lessonAttendance.findMany({
      where: { student_id: userId },
      orderBy: { lesson: { scheduled_at: 'desc' } },
      take: limit,
      select: {
        status: true,
        lesson: {
          select: {
            title: true,
            scheduled_at: true,
            class: {
              select: {
                title: true,
                language: { select: { name_ru: true, flag_emoji: true, color: true } },
              },
            },
          },
        },
      },
    });

    return rows.map((r) => ({
      title: r.lesson.title,
      scheduled_at: r.lesson.scheduled_at,
      status: r.status,
      class_title: r.lesson.class.title,
      language: r.lesson.class.language,
    }));
  }

  /**
   * PATCH /users/me/notification-channels
   * Пока сохраняем в user.locale (будущая таблица settings).
   * Возвращает acknowledged: true (реальная настройка — Этап 12).
   */
  async updateNotificationChannels(_userId: string, _dto: { telegram?: boolean; email?: boolean }) {
    // TODO Этап 12: сохранять в user_notification_settings
    return { ok: true, acknowledged: true };
  }

  /**
   * PATCH /users/me/onboard — self-service выбор роли при первом входе.
   * Юзер сам выбирает STUDENT (учусь сам) или PARENT (записываю ребёнка)
   * и сразу активируется — без ожидания менеджера (убираем трение для клиентов).
   * Разрешено только из начальной роли (STUDENT/PARENT); привилегии не трогаем.
   */
  async onboardSelf(userId: string, role: Role) {
    if (role !== Role.STUDENT && role !== Role.PARENT) {
      throw new BadRequestException('Onboarding role must be STUDENT or PARENT');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== Role.STUDENT && user.role !== Role.PARENT) {
      throw new ForbiddenException('Cannot change this role via onboarding');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role, is_active: true },
      select: { id: true, role: true, is_active: true },
    });
  }

  // ─── Admin endpoints ────────────────────────────────────────────────────────

  /**
   * GET /users/pending — список неактивированных пользователей.
   * MANAGER / ADMIN / SUPER_ADMIN only.
   */
  async findPending() {
    const users = await this.prisma.user.findMany({
      where: { is_active: false },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        telegram_user_id: true,
        telegram_username: true,
        first_name: true,
        last_name: true,
        avatar_url: true,
        role: true,
        is_active: true,
        created_at: true,
      },
    });

    return users.map((u) => ({ ...u, telegram_user_id: u.telegram_user_id.toString() }));
  }

  /**
   * PATCH /users/:id/activate — активировать пользователя.
   * MANAGER / ADMIN / SUPER_ADMIN only.
   * Опционально: задать роль при активации.
   */
  async activateUser(targetId: string, role?: Role) {
    const existing = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!existing) throw new NotFoundException('User not found');

    if (role && PROTECTED_ROLES.includes(role)) {
      throw new ForbiddenException(`Cannot assign role ${role} via this endpoint`);
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        is_active: true,
        ...(role ? { role, token_version: { increment: 1 } } : {}),
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        token_version: true,
      },
    });

    return updated;
  }

  /**
   * PATCH /users/:id/role — изменить роль пользователя.
   * ADMIN / SUPER_ADMIN only (MANAGER cannot promote to ADMIN).
   * Инкрементирует token_version → инвалидирует все активные JWT.
   */
  async changeRole(actorRole: Role, targetId: string, newRole: Role) {
    // MANAGER не может назначить ADMIN/SUPER_ADMIN
    if (
      actorRole === Role.MANAGER &&
      ([Role.ADMIN, Role.SUPER_ADMIN] as Role[]).includes(newRole)
    ) {
      throw new ForbiddenException('MANAGER cannot assign ADMIN or SUPER_ADMIN role');
    }

    if (PROTECTED_ROLES.includes(newRole) && actorRole !== Role.SUPER_ADMIN) {
      throw new ForbiddenException(`Only SUPER_ADMIN can assign role ${newRole}`);
    }

    const existing = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!existing) throw new NotFoundException('User not found');

    if (existing.role === newRole) {
      throw new BadRequestException(`User already has role ${newRole}`);
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        role: newRole,
        token_version: { increment: 1 },
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        role: true,
        is_active: true,
        token_version: true,
      },
    });

    return updated;
  }

  /**
   * GET /users — список всех пользователей (paginated).
   * MANAGER / ADMIN / SUPER_ADMIN only.
   */
  async findAll(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          telegram_user_id: true,
          telegram_username: true,
          first_name: true,
          last_name: true,
          avatar_url: true,
          role: true,
          is_active: true,
          created_at: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users.map((u) => ({ ...u, telegram_user_id: u.telegram_user_id.toString() })),
      total,
      page,
      limit,
    };
  }
}
