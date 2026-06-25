import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/** Вычисляет уровень учителя на основе среднего рейтинга и числа оценок */
function computeTeacherLevel(avgRating: number | null, ratingsCount: number) {
  if (ratingsCount < 5) return { label: 'Новый', color: '#6B7280', min_votes: 5 };
  if (avgRating == null) return { label: 'Новый', color: '#6B7280', min_votes: 5 };

  // Бонус за количество оценок (верифицированный преподаватель)
  const verified = ratingsCount >= 100;
  const prefix = verified ? '✓ ' : '';

  if (avgRating >= 4.7) return { label: `${prefix}Мастер`, color: '#F97316', verified };
  if (avgRating >= 4.2) return { label: `${prefix}Эксперт`, color: '#8B5CF6', verified };
  if (avgRating >= 3.5) return { label: `${prefix}Опытный`, color: '#3B82F6', verified };
  if (avgRating >= 2.5) return { label: `${prefix}Специалист`, color: '#10B981', verified };
  return { label: `${prefix}Начинающий`, color: '#F59E0B', verified };
}

@Injectable()
export class TeachersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /teachers — список всех активных учителей с базовой инфо.
   */
  async findAll() {
    const teachers = await this.prisma.teacher.findMany({
      include: {
        user: {
          select: { id: true, first_name: true, last_name: true, avatar_url: true },
        },
        ratings: { select: { rating: true } },
        badges: {
          orderBy: { awarded_at: 'desc' },
          take: 3,
        },
        classes: {
          where: { is_active: true },
          select: {
            id: true,
            title: true,
            level: true,
            language: { select: { flag_emoji: true, name_ru: true } },
            _count: {
              select: { enrollments: { where: { status: { in: ['ACTIVE', 'PENDING'] } } } },
            },
            max_students: true,
          },
        },
      },
    });

    return teachers.map((t) => this.formatTeacher(t));
  }

  /**
   * GET /teachers/:teacherId — публичный профиль учителя.
   */
  async findOne(teacherId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            avatar_url: true,
          },
        },
        ratings: { select: { rating: true, comment: true, created_at: true } },
        badges: {
          orderBy: { awarded_at: 'desc' },
        },
        classes: {
          where: { is_active: true },
          select: {
            id: true,
            title: true,
            level: true,
            price_uzs: true,
            max_students: true,
            schedule_days: true,
            schedule_time: true,
            schedule_duration: true,
            description: true,
            language: {
              select: { id: true, flag_emoji: true, name_ru: true, color: true },
            },
            _count: {
              select: {
                enrollments: { where: { status: { in: ['ACTIVE', 'PENDING', 'WAITLIST'] } } },
              },
            },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!teacher) throw new NotFoundException('Teacher not found');

    return this.formatTeacher(teacher, true);
  }

  /**
   * GET /teachers/by-user/:userId — профиль учителя по user_id.
   */
  async findByUserId(userId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return this.findOne(teacher.id);
  }

  /** Форматирует данные учителя для API ответа */
  private formatTeacher(
    t: {
      id: string;
      bio: string | null;
      photo_url: string | null;
      website_url?: string | null;
      instagram_url?: string | null;
      telegram_url?: string | null;
      user: { id: string; first_name: string; last_name: string | null; avatar_url: string | null };
      ratings: { rating: number; comment?: string | null; created_at?: Date }[];
      badges: {
        id: string;
        title: string;
        description: string | null;
        icon: string;
        type: string;
        awarded_at: Date;
      }[];
      classes: {
        id: string;
        title: string;
        level: string;
        price_uzs?: number;
        max_students: number;
        schedule_days?: string[];
        schedule_time?: string | null;
        schedule_duration?: number | null;
        description?: string | null;
        language: { id?: string; flag_emoji: string; name_ru: string; color?: string | null };
        _count: { enrollments: number };
      }[];
    },
    includeRecentRatings = false,
  ) {
    const ratingsCount = t.ratings.length;
    const avgRating =
      ratingsCount > 0
        ? Math.round((t.ratings.reduce((s, r) => s + r.rating, 0) / ratingsCount) * 10) / 10
        : null;

    const level = computeTeacherLevel(avgRating, ratingsCount);

    // Рейтинг по звёздам (гистограмма)
    const stars = [1, 2, 3, 4, 5].map((s) => ({
      stars: s,
      count: t.ratings.filter((r) => r.rating === s).length,
    }));

    const classesFormatted = t.classes.map((c) => ({
      id: c.id,
      title: c.title,
      level: c.level,
      price_uzs: c.price_uzs,
      max_students: c.max_students,
      enrolled_count: c._count.enrollments,
      spots_left: Math.max(0, c.max_students - c._count.enrollments),
      is_full: c._count.enrollments >= c.max_students,
      schedule_days: c.schedule_days,
      schedule_time: c.schedule_time,
      schedule_duration: c.schedule_duration,
      description: c.description,
      language: c.language,
    }));

    return {
      id: t.id,
      user: t.user,
      bio: t.bio,
      photo_url: t.photo_url ?? t.user.avatar_url,
      website_url: t.website_url,
      instagram_url: t.instagram_url,
      telegram_url: t.telegram_url,
      avg_rating: avgRating,
      ratings_count: ratingsCount,
      stars_breakdown: stars,
      level,
      badges: t.badges,
      classes: classesFormatted,
      recent_reviews: includeRecentRatings
        ? t.ratings
            .filter((r) => r.comment)
            .slice(0, 5)
            .map((r) => ({ rating: r.rating, comment: r.comment }))
        : undefined,
    };
  }

  /**
   * POST /teachers/:teacherId/rate — студент оценивает учителя.
   * Условие: студент должен иметь ACTIVE запись в одном из классов этого учителя.
   * Оценка уникальна на пару (student_id, class_id).
   */
  async rateTeacher(
    studentId: string,
    teacherId: string,
    data: { class_id: string; rating: number; comment?: string },
  ) {
    if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
      throw new BadRequestException('Rating must be integer 1-5');
    }

    // Убедиться что этот класс принадлежит данному учителю
    const cls = await this.prisma.class.findFirst({
      where: { id: data.class_id, teacher: { id: teacherId } },
      select: { id: true },
    });
    if (!cls) throw new NotFoundException('Class not found for this teacher');

    // Студент должен иметь активную запись
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        student_id: studentId,
        class_id: data.class_id,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) {
      throw new ForbiddenException('You must be an active student in this class to rate');
    }

    // Upsert — один студент может изменить оценку
    const result = await this.prisma.teacherRating.upsert({
      where: {
        student_id_class_id: {
          student_id: studentId,
          class_id: data.class_id,
        },
      },
      create: {
        student_id: studentId,
        teacher_id: teacherId,
        class_id: data.class_id,
        rating: data.rating,
        comment: data.comment ?? null,
      },
      update: {
        rating: data.rating,
        comment: data.comment ?? null,
      },
    });

    return result;
  }

  /**
   * GET /teachers/:teacherId/my-rating — моя текущая оценка учителя.
   */
  async getMyRating(studentId: string, teacherId: string) {
    const ratings = await this.prisma.teacherRating.findMany({
      where: { student_id: studentId, teacher_id: teacherId },
      select: { id: true, class_id: true, rating: true, comment: true, created_at: true },
    });
    return ratings;
  }

  /**
   * POST /teachers/:teacherId/badges — менеджер/админ выдаёт бейдж учителю.
   */
  async awardBadge(
    teacherId: string,
    awardedBy: string,
    data: { title: string; description?: string; icon: string; type?: string },
  ) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    return this.prisma.teacherBadge.create({
      data: {
        teacher_id: teacherId,
        awarded_by: awardedBy,
        title: data.title,
        description: data.description,
        icon: data.icon,
        type: data.type ?? 'badge',
      },
    });
  }

  /**
   * DELETE /teachers/:teacherId/badges/:badgeId — удалить бейдж.
   */
  async removeBadge(badgeId: string) {
    return this.prisma.teacherBadge.delete({ where: { id: badgeId } });
  }

  /**
   * PATCH /teachers/:teacherId — учитель обновляет свой профиль.
   */
  async updateProfile(
    userId: string,
    data: {
      bio?: string;
      website_url?: string;
      instagram_url?: string;
      telegram_url?: string;
    },
  ) {
    const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId } });
    if (!teacher) throw new NotFoundException('Teacher profile not found');

    return this.prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        bio: data.bio,
        website_url: data.website_url,
        instagram_url: data.instagram_url,
        telegram_url: data.telegram_url,
      },
      select: {
        id: true,
        bio: true,
        website_url: true,
        instagram_url: true,
        telegram_url: true,
      },
    });
  }

  /**
   * Вычисляет стоимость перевода студента из from_class в to_class.
   * Если учитель to_class имеет более высокий рейтинг → платный перевод.
   * Сумма = 10% от стоимости to_class.
   */
  async computeTransferFee(fromClassId: string, toClassId: string): Promise<number> {
    const [fromClass, toClass] = await Promise.all([
      this.prisma.class.findUnique({
        where: { id: fromClassId },
        select: {
          price_uzs: true,
          teacher: {
            select: { ratings: { select: { rating: true } } },
          },
        },
      }),
      this.prisma.class.findUnique({
        where: { id: toClassId },
        select: {
          price_uzs: true,
          teacher: {
            select: { ratings: { select: { rating: true } } },
          },
        },
      }),
    ]);

    if (!fromClass || !toClass) return 0;

    const fromRatings = fromClass.teacher.ratings;
    const toRatings = toClass.teacher.ratings;

    const fromAvg =
      fromRatings.length > 0
        ? fromRatings.reduce((s, r) => s + r.rating, 0) / fromRatings.length
        : 0;
    const toAvg =
      toRatings.length > 0 ? toRatings.reduce((s, r) => s + r.rating, 0) / toRatings.length : 0;

    if (toAvg > fromAvg) {
      // Платный перевод: 10% от стоимости нового класса
      return Math.round(toClass.price_uzs * 0.1);
    }

    return 0; // Бесплатно
  }
}
