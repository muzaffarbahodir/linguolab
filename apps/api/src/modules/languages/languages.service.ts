import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const CACHE_KEY = 'cache:languages';
const CACHE_TTL = 300; // 5 минут

export interface UpsertLanguageDto {
  code?: string;
  name_ru?: string;
  flag_emoji?: string;
  color?: string | null;
  image_url?: string | null;
  description?: string | null;
  duration_label?: string | null;
  includes?: string[];
  requirements?: string[];
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
        color: true,
        image_url: true,
        description: true,
        duration_label: true,
        includes: true,
        requirements: true,
        _count: {
          select: { classes: { where: { is_active: true, status: { in: [...JOINABLE] } } } },
        },
      },
    });

    const result = languages.map((l) => ({
      ...l,
      groups_count: l._count.classes,
      _count: undefined,
    }));

    // Кэшируем на 5 минут (fire-and-forget)
    void this.redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(result));

    return result;
  }

  /**
   * GET /languages/:id/course — детальная страница курса (направления):
   * инфо о курсе + классы (учителя) под ним + рекомендованный (свободный, лучший рейтинг).
   */
  async getCourseDetail(id: string) {
    const course = await this.prisma.language.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name_ru: true,
        flag_emoji: true,
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

    return { course, classes: mapped, recommended_class_id: recommended?.id ?? null };
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
