import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { StudyFormat, StudyMode, LanguageCategory } from '@prisma/client';

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
        study_format: true,
        study_mode: true,
        preferred_category: true,
        discovery_done_at: true,
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
   * GET /users/leaderboard — рейтинг студентов по очкам реальной учёбы.
   *
   * Очки = посещения×10 (PRESENT) / ×5 (LATE) + проверенные ДЗ×5 + достижения×25.
   * Посещения весят больше всего — рейтинг отражает «кто реально ходит и учится»,
   * а не у кого случайно набралось достижений. Считаем дёшево через groupBy.
   *
   * Порядок детерминирован: очки ↓, затем число посещений ↓, затем имя ↑ —
   * чтобы при равных очках порядок не «прыгал» между перезагрузками.
   */
  async getLeaderboard(currentUserId: string) {
    const students = await this.prisma.user.findMany({
      where: { role: 'STUDENT', is_active: true },
      select: { id: true, first_name: true, last_name: true, avatar_url: true },
    });
    if (students.length === 0) {
      return { top: [], me: null, total: 0 };
    }

    const [attByStatus, hw, ach] = await Promise.all([
      // Посещения с разбивкой по статусу — PRESENT и LATE весят по-разному.
      this.prisma.lessonAttendance.groupBy({
        by: ['student_id', 'status'],
        where: { status: { in: ['PRESENT', 'LATE'] } },
        _count: { _all: true },
      }),
      this.prisma.homeworkSubmission.groupBy({
        by: ['student_id'],
        where: { status: 'GRADED' },
        _count: { _all: true },
      }),
      this.prisma.userAchievement.groupBy({ by: ['user_id'], _count: { _all: true } }),
    ]);

    const presentMap = new Map<string, number>();
    const lateMap = new Map<string, number>();
    for (const row of attByStatus) {
      if (row.status === 'PRESENT') presentMap.set(row.student_id, row._count._all);
      else if (row.status === 'LATE') lateMap.set(row.student_id, row._count._all);
    }
    const hwMap = new Map(hw.map((h) => [h.student_id, h._count._all]));
    const achMap = new Map(ach.map((a) => [a.user_id, a._count._all]));

    const ranked = students
      .map((s) => {
        const present = presentMap.get(s.id) ?? 0;
        const late = lateMap.get(s.id) ?? 0;
        const attended = present + late;
        const points =
          present * 10 + late * 5 + (hwMap.get(s.id) ?? 0) * 5 + (achMap.get(s.id) ?? 0) * 25;
        return {
          id: s.id,
          name: `${s.first_name}${s.last_name ? ' ' + s.last_name[0] + '.' : ''}`,
          avatar_url: s.avatar_url,
          points,
          _attended: attended,
          _sortName: (s.first_name ?? '').toLocaleLowerCase('ru'),
        };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b._attended - a._attended ||
          a._sortName.localeCompare(b._sortName, 'ru'),
      )
      .map((s, i) => ({
        id: s.id,
        name: s.name,
        avatar_url: s.avatar_url,
        points: s.points,
        rank: i + 1,
        is_me: s.id === currentUserId,
      }));

    const me = ranked.find((r) => r.is_me) ?? null;
    return { top: ranked.slice(0, 30), me, total: ranked.length };
  }

  /**
   * GET /users/me/game-progress — кросс-девайс прогресс мини-игр (XP + SRS).
   * Возвращает сырой JSON-блоб (или null). Слияние делает клиент.
   */
  async getGameProgress(userId: string) {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { game_progress: true },
    });
    return { data: row?.game_progress ?? null };
  }

  /**
   * PUT /users/me/game-progress — сохранить прогресс мини-игр (клиент шлёт уже
   * слитый блоб). Ограничиваем размер, чтобы не раздувать строку.
   */
  async saveGameProgress(userId: string, data: unknown) {
    if (data == null || typeof data !== 'object') {
      throw new BadRequestException('Invalid progress');
    }
    if (JSON.stringify(data).length > 200_000) {
      throw new BadRequestException('Progress too large');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { game_progress: data as unknown as Prisma.InputJsonValue },
    });
    return { ok: true };
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

  /**
   * PATCH /users/me/discovery — сохранить ответы опроса подбора курса.
   * study_format обязателен (шаг 2). study_mode / preferred_category можно
   * пропустить (null). Проставляет discovery_done_at — визард больше не показываем.
   */
  async saveDiscovery(
    userId: string,
    dto: {
      study_format?: StudyFormat;
      study_mode?: StudyMode | null;
      preferred_category?: LanguageCategory | null;
    },
  ) {
    const fmt = dto.study_format;
    if (fmt !== 'ONLINE' && fmt !== 'OFFLINE') {
      throw new BadRequestException('study_format must be ONLINE or OFFLINE');
    }
    const mode =
      dto.study_mode === 'INDIVIDUAL' || dto.study_mode === 'GROUP' ? dto.study_mode : null;
    const CATS = ['LANGUAGES', 'IELTS', 'SAT', 'CEFR', 'DTM', 'MILLIY_SERTIFIKAT'];
    const category =
      dto.preferred_category && CATS.includes(dto.preferred_category)
        ? dto.preferred_category
        : null;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        study_format: fmt,
        study_mode: mode,
        preferred_category: category,
        discovery_done_at: new Date(),
      },
      select: {
        study_format: true,
        study_mode: true,
        preferred_category: true,
        discovery_done_at: true,
      },
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
