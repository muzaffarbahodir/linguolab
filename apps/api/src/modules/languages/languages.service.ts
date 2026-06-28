import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, type LanguageCategory } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const CACHE_KEY = 'cache:languages';
const CACHE_TTL = 300; // 5 минут

export interface UpsertLanguageDto {
  code?: string;
  name_ru?: string;
  flag_emoji?: string;
  category?: LanguageCategory;
  color?: string | null;
  image_url?: string | null;
  description?: string | null;
  duration_label?: string | null;
  includes?: string[];
  requirements?: string[];
  is_active?: boolean;
}

export interface LessonMaterial {
  title: string;
  url: string;
  type?: string;
}

export interface UpsertLessonDto {
  order?: number;
  title?: string;
  description?: string | null;
  duration_min?: number | null;
  is_preview?: boolean;
  video_url?: string | null;
  materials?: LessonMaterial[];
  is_active?: boolean;
}

const JOINABLE = ['ENROLLMENT_OPEN', 'ACTIVE'] as const;

@Injectable()
export class LanguagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findAll() {
    // Пробуем достать из Redis
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached) as unknown[];

    const languages = await this.prisma.language.findMany({
      where: { is_active: true },
      orderBy: { name_ru: 'asc' },
      select: {
        id: true,
        code: true,
        name_ru: true,
        flag_emoji: true,
        category: true,
        color: true,
        image_url: true,
        description: true,
        duration_label: true,
        includes: true,
        requirements: true,
        _count: {
          select: { classes: { where: { is_active: true, status: { in: [...JOINABLE] } } } },
        },
        reviews: { where: { is_hidden: false }, select: { rating: true } },
      },
    });

    const result = languages.map((l) => {
      const ratings = l.reviews;
      const avg = ratings.length
        ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
        : null;
      return {
        ...l,
        groups_count: l._count.classes,
        avg_rating: avg,
        reviews_count: ratings.length,
        _count: undefined,
        reviews: undefined,
      };
    });

    // Кэшируем на 5 минут (fire-and-forget)
    void this.redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(result));

    return result;
  }

  /**
   * GET /languages/:id/course — детальная страница курса (направления):
   * инфо о курсе + классы (учителя) под ним + рекомендованный (свободный, лучший рейтинг).
   */
  async getCourseDetail(id: string, userId?: string) {
    const course = await this.prisma.language.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name_ru: true,
        flag_emoji: true,
        category: true,
        color: true,
        image_url: true,
        description: true,
        duration_label: true,
        includes: true,
        requirements: true,
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const classes = await this.prisma.class.findMany({
      where: { language_id: id, is_active: true, status: { in: [...JOINABLE] } },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        title: true,
        level: true,
        price_uzs: true,
        price_usd: true,
        max_students: true,
        status: true,
        description: true,
        schedule_days: true,
        schedule_time: true,
        schedule_duration: true,
        teacher: {
          select: {
            id: true,
            bio: true,
            photo_url: true,
            user: { select: { first_name: true, last_name: true, avatar_url: true } },
            ratings: { select: { rating: true } },
          },
        },
        _count: {
          select: { enrollments: { where: { status: { in: ['ACTIVE', 'PENDING'] } } } },
        },
      },
    });

    const mapped = classes.map((c) => {
      const ratings = c.teacher.ratings;
      const avg = ratings.length
        ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
        : null;
      return {
        id: c.id,
        title: c.title,
        level: c.level,
        price_uzs: c.price_uzs,
        price_usd: c.price_usd,
        status: c.status,
        description: c.description,
        schedule_days: c.schedule_days,
        schedule_time: c.schedule_time,
        schedule_duration: c.schedule_duration,
        spots_left: c.max_students - c._count.enrollments,
        max_students: c.max_students,
        teacher: {
          id: c.teacher.id,
          bio: c.teacher.bio,
          photo_url: c.teacher.photo_url,
          user: c.teacher.user,
          avg_rating: avg,
          ratings_count: ratings.length,
        },
      };
    });

    // Рекомендованный: со свободными местами, лучший рейтинг, затем больше мест.
    const recommended =
      mapped
        .filter((c) => c.spots_left > 0)
        .sort(
          (a, b) =>
            (b.teacher.avg_rating ?? -1) - (a.teacher.avg_rating ?? -1) ||
            b.spots_left - a.spots_left,
        )[0] ?? null;

    // Офферы учителей — «готов учить» ещё до открытия группы.
    const offersRaw = await this.prisma.teacherOffer.findMany({
      where: { language_id: id, is_active: true },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        level: true,
        format: true,
        price_uzs: true,
        price_usd: true,
        note: true,
        teacher: {
          select: {
            id: true,
            bio: true,
            photo_url: true,
            user: { select: { first_name: true, last_name: true, avatar_url: true } },
            ratings: { select: { rating: true } },
          },
        },
      },
    });
    const offers = offersRaw.map((o) => {
      const r = o.teacher.ratings;
      const avg = r.length
        ? Math.round((r.reduce((s, x) => s + x.rating, 0) / r.length) * 10) / 10
        : null;
      return {
        id: o.id,
        level: o.level,
        format: o.format,
        price_uzs: o.price_uzs,
        price_usd: o.price_usd,
        note: o.note,
        teacher: {
          id: o.teacher.id,
          bio: o.teacher.bio,
          photo_url: o.teacher.photo_url,
          user: o.teacher.user,
          avg_rating: avg,
          ratings_count: r.length,
        },
      };
    });

    // Программа курса + доступ к материалам.
    // Записан (ACTIVE) на любую группу этого направления → материалы открыты.
    const enrolled = userId
      ? (await this.prisma.enrollment.count({
          where: { student_id: userId, status: 'ACTIVE', class: { language_id: id } },
        })) > 0
      : false;

    const lessonsRaw = await this.prisma.courseLesson.findMany({
      where: { language_id: id, is_active: true },
      orderBy: { order: 'asc' },
    });
    const lessons = lessonsRaw.map((l) => {
      const unlocked = enrolled || l.is_preview;
      const mats = Array.isArray(l.materials) ? l.materials : [];
      return {
        id: l.id,
        order: l.order,
        title: l.title,
        description: l.description,
        duration_min: l.duration_min,
        is_preview: l.is_preview,
        unlocked,
        // URL отдаём только при доступе — не светим ссылки незаписанным.
        video_url: unlocked ? l.video_url : null,
        materials: unlocked ? mats : [],
        materials_count: mats.length,
      };
    });

    // Отзывы на курс: агрегат + последние + свой отзыв + право оставить.
    const reviewsRaw = await this.prisma.courseReview.findMany({
      where: { language_id: id, is_hidden: false },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        rating: true,
        comment: true,
        created_at: true,
        student_id: true,
        student: { select: { first_name: true, last_name: true, avatar_url: true } },
      },
    });
    const agg = await this.prisma.courseReview.aggregate({
      where: { language_id: id, is_hidden: false },
      _avg: { rating: true },
      _count: true,
    });
    const myReview = userId
      ? await this.prisma.courseReview.findUnique({
          where: { language_id_student_id: { language_id: id, student_id: userId } },
          select: { id: true, rating: true, comment: true, is_hidden: true },
        })
      : null;
    // Оставлять отзыв может тот, кто записан/был записан (ACTIVE/DROPPED).
    const canReview = userId
      ? (await this.prisma.enrollment.count({
          where: {
            student_id: userId,
            status: { in: ['ACTIVE', 'DROPPED'] },
            class: { language_id: id },
          },
        })) > 0
      : false;

    const reviews = reviewsRaw.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      author: `${r.student.first_name}${r.student.last_name ? ' ' + r.student.last_name[0] + '.' : ''}`,
      avatar_url: r.student.avatar_url,
      is_mine: r.student_id === userId,
    }));

    return {
      course,
      classes: mapped,
      recommended_class_id: recommended?.id ?? null,
      offers,
      lessons,
      enrolled,
      rating: {
        avg: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
        count: agg._count,
      },
      reviews,
      my_review: myReview,
      can_review: canReview,
    };
  }

  // ─── Отзывы на курс (CourseReview) ─────────────────────────────────────────────

  async upsertReview(userId: string, languageId: string, rating: number, comment?: string | null) {
    const r = Math.round(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      throw new BadRequestException('Rating must be 1..5');
    }
    const canReview =
      (await this.prisma.enrollment.count({
        where: {
          student_id: userId,
          status: { in: ['ACTIVE', 'DROPPED'] },
          class: { language_id: languageId },
        },
      })) > 0;
    if (!canReview) {
      throw new ForbiddenException('Отзыв можно оставить только после записи на курс');
    }
    return this.prisma.courseReview.upsert({
      where: { language_id_student_id: { language_id: languageId, student_id: userId } },
      create: {
        language_id: languageId,
        student_id: userId,
        rating: r,
        comment: comment?.trim() || null,
      },
      update: { rating: r, comment: comment?.trim() || null, is_hidden: false },
      select: { id: true, rating: true, comment: true },
    });
  }

  async deleteReview(reviewId: string, userId: string, isAdmin: boolean) {
    const review = await this.prisma.courseReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    if (!isAdmin && review.student_id !== userId) {
      throw new ForbiddenException('Not your review');
    }
    await this.prisma.courseReview.delete({ where: { id: reviewId } });
    return { ok: true };
  }

  /** Скрыть/показать отзыв (модерация, MANAGER+). */
  async setReviewHidden(reviewId: string, hidden: boolean) {
    const review = await this.prisma.courseReview.findUnique({ where: { id: reviewId } });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.courseReview.update({ where: { id: reviewId }, data: { is_hidden: hidden } });
    return { ok: true, is_hidden: hidden };
  }

  // ─── Программа курса (CourseLesson) — admin CRUD ───────────────────────────────

  /** Все уроки направления (включая выключенные/скрытые) — для редактора. */
  listLessonsAdmin(languageId: string) {
    return this.prisma.courseLesson.findMany({
      where: { language_id: languageId },
      orderBy: { order: 'asc' },
    });
  }

  async createLesson(languageId: string, dto: UpsertLessonDto) {
    const lang = await this.prisma.language.findUnique({ where: { id: languageId } });
    if (!lang) throw new NotFoundException('Language not found');
    // По умолчанию ставим в конец программы.
    const last = await this.prisma.courseLesson.findFirst({
      where: { language_id: languageId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return this.prisma.courseLesson.create({
      data: {
        language_id: languageId,
        order: dto.order ?? (last ? last.order + 1 : 0),
        title: dto.title ?? '',
        description: dto.description ?? null,
        duration_min: dto.duration_min ?? null,
        is_preview: dto.is_preview ?? false,
        video_url: dto.video_url ?? null,
        materials: (dto.materials ?? []) as unknown as Prisma.InputJsonValue,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async updateLesson(lessonId: string, dto: UpsertLessonDto) {
    const existing = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } });
    if (!existing) throw new NotFoundException('Lesson not found');
    return this.prisma.courseLesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.duration_min !== undefined ? { duration_min: dto.duration_min } : {}),
        ...(dto.is_preview !== undefined ? { is_preview: dto.is_preview } : {}),
        ...(dto.video_url !== undefined ? { video_url: dto.video_url } : {}),
        ...(dto.materials !== undefined
          ? { materials: dto.materials as unknown as Prisma.InputJsonValue }
          : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      },
    });
  }

  async deleteLesson(lessonId: string) {
    const existing = await this.prisma.courseLesson.findUnique({ where: { id: lessonId } });
    if (!existing) throw new NotFoundException('Lesson not found');
    await this.prisma.courseLesson.delete({ where: { id: lessonId } });
    return { ok: true };
  }

  // ─── Admin (SUPER_ADMIN) ──────────────────────────────────────────────────────

  /** Все языки, включая выключенные, для панели управления. */
  findAllAdmin() {
    return this.prisma.language.findMany({
      orderBy: { name_ru: 'asc' },
    });
  }

  async create(dto: UpsertLanguageDto) {
    const created = await this.prisma.language.create({
      data: {
        code: dto.code ?? '',
        name_ru: dto.name_ru ?? '',
        flag_emoji: dto.flag_emoji ?? '',
        category: dto.category ?? 'LANGUAGES',
        color: dto.color ?? null,
        image_url: dto.image_url ?? null,
        description: dto.description ?? null,
        is_active: dto.is_active ?? true,
      },
    });
    await this.bustCache();
    return created;
  }

  async update(id: string, dto: UpsertLanguageDto) {
    const existing = await this.prisma.language.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Language not found');

    const updated = await this.prisma.language.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name_ru !== undefined ? { name_ru: dto.name_ru } : {}),
        ...(dto.flag_emoji !== undefined ? { flag_emoji: dto.flag_emoji } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.image_url !== undefined ? { image_url: dto.image_url } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.duration_label !== undefined ? { duration_label: dto.duration_label } : {}),
        ...(dto.includes !== undefined ? { includes: dto.includes } : {}),
        ...(dto.requirements !== undefined ? { requirements: dto.requirements } : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      },
    });
    await this.bustCache();
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.language.findUnique({
      where: { id },
      include: { _count: { select: { classes: true } } },
    });
    if (!existing) throw new NotFoundException('Language not found');

    // Если есть связанные курсы — не удаляем, а деактивируем (сохраняем историю).
    if (existing._count.classes > 0) {
      const updated = await this.prisma.language.update({
        where: { id },
        data: { is_active: false },
      });
      await this.bustCache();
      return { soft_deleted: true, language: updated };
    }

    await this.prisma.language.delete({ where: { id } });
    await this.bustCache();
    return { soft_deleted: false };
  }

  private async bustCache() {
    await this.redis.del(CACHE_KEY);
  }
}
