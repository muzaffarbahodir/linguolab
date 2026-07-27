import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpdateTeacherProfileDto } from './dto/update-teacher-profile.dto';

/** Язык, которым владеет преподаватель: «English — C2». */
export interface SpokenLanguage {
  name: string;
  level: string;
}

/** Строка образования: «Магистр филологии, НУУз, 2018». */
export interface EducationEntry {
  title: string;
  org?: string;
  year?: number;
}

/**
 * Разбирает Json-поле в список объектов заданной формы.
 *
 * Данные в Json попадают через API и переживают миграции схемы, поэтому
 * доверять их форме нельзя: кривая запись должна выпасть из выдачи, а не
 * уронить весь профиль.
 */
function parseJsonList<T>(raw: unknown, pick: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw.slice(0, 30)) {
    if (!item || typeof item !== 'object') continue;
    const value = pick(item as Record<string, unknown>);
    if (value) out.push(value);
  }
  return out;
}

function parseSpeaks(raw: unknown): SpokenLanguage[] {
  return parseJsonList(raw, (d) =>
    typeof d.name === 'string' && d.name.trim()
      ? {
          name: d.name.slice(0, 60),
          level: typeof d.level === 'string' ? d.level.slice(0, 30) : '',
        }
      : null,
  );
}

function parseEducation(raw: unknown): EducationEntry[] {
  return parseJsonList(raw, (d) =>
    typeof d.title === 'string' && d.title.trim()
      ? {
          title: d.title.slice(0, 160),
          org: typeof d.org === 'string' ? d.org.slice(0, 160) : undefined,
          year: typeof d.year === 'number' && Number.isInteger(d.year) ? d.year : undefined,
        }
      : null,
  );
}

/**
 * Имя автора отзыва для публичной страницы: «Азиз К.».
 *
 * Профиль открыт без авторизации, и выкладывать фамилии учеников целиком в
 * открытый доступ незачем — первой буквы хватает, чтобы отзывы не выглядели
 * анонимными.
 */
function reviewerName(first: string, last: string | null): string {
  const initial = last?.trim()?.[0];
  return initial ? `${first} ${initial}.` : first;
}

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

    const stats = await this.loadStats(teachers.map((t) => t.id));
    return teachers.map((t) => this.formatTeacher(t, false, stats.get(t.id)));
  }

  /**
   * Считает по преподавателям проведённые уроки и число учеников.
   *
   * Обе цифры — главный аргумент витрины: «511 уроков» говорит о человеке
   * больше, чем звёзды, которые легко набрать на пяти отзывах.
   *
   * Уроки берутся по всем классам, включая закрытые: курс закончился, а
   * проведённые занятия из опыта преподавателя никуда не делись. Ученики,
   * наоборот, считаются только по активным записям — это «сейчас учится
   * столько-то», а не «когда-либо приходило».
   */
  private async loadStats(
    teacherIds: string[],
  ): Promise<Map<string, { lessons_conducted: number; students_count: number }>> {
    const result = new Map<string, { lessons_conducted: number; students_count: number }>();
    if (teacherIds.length === 0) return result;

    // Классы отдельным запросом: уроки и записи связаны с преподавателем через
    // класс, и без этой карты пришлось бы делать по запросу на преподавателя.
    const classes = await this.prisma.class.findMany({
      where: { teacher_id: { in: teacherIds } },
      select: { id: true, teacher_id: true },
    });
    const classToTeacher = new Map(classes.map((c) => [c.id, c.teacher_id]));
    const classIds = classes.map((c) => c.id);

    for (const id of teacherIds) result.set(id, { lessons_conducted: 0, students_count: 0 });
    if (classIds.length === 0) return result;

    const [lessonGroups, enrollments] = await Promise.all([
      this.prisma.lesson.groupBy({
        by: ['class_id'],
        where: { class_id: { in: classIds }, status: 'COMPLETED' },
        _count: { _all: true },
      }),
      // distinct на уровне БД сгруппировал бы по паре (студент, класс), а один
      // ученик может ходить к преподавателю на два курса. Считаем множеством.
      this.prisma.enrollment.findMany({
        where: { class_id: { in: classIds }, status: 'ACTIVE' },
        select: { student_id: true, class_id: true },
      }),
    ]);

    for (const g of lessonGroups) {
      const teacherId = classToTeacher.get(g.class_id);
      const row = teacherId && result.get(teacherId);
      if (row) row.lessons_conducted += g._count._all;
    }

    const students = new Map<string, Set<string>>();
    for (const e of enrollments) {
      const teacherId = classToTeacher.get(e.class_id);
      if (!teacherId) continue;
      const set = students.get(teacherId) ?? new Set<string>();
      set.add(e.student_id);
      students.set(teacherId, set);
    }
    for (const [teacherId, set] of students) {
      const row = result.get(teacherId);
      if (row) row.students_count = set.size;
    }

    return result;
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
        ratings: {
          select: {
            rating: true,
            comment: true,
            created_at: true,
            // Отзыв без автора и курса читается как выдуманный — а именно
            // отзывы решают, запишется студент или закроет страницу.
            student: { select: { first_name: true, last_name: true, avatar_url: true } },
            class: { select: { title: true } },
          },
          orderBy: { created_at: 'desc' },
        },
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

    const stats = await this.loadStats([teacher.id]);
    return this.formatTeacher(teacher, true, stats.get(teacher.id));
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
      headline?: string | null;
      intro_video_url?: string | null;
      intro_video_poster?: string | null;
      country?: string | null;
      experience_years?: number | null;
      specializations?: string[];
      highlights?: string[];
      speaks?: unknown;
      education?: unknown;
      user: { id: string; first_name: string; last_name: string | null; avatar_url: string | null };
      ratings: {
        rating: number;
        comment?: string | null;
        created_at?: Date;
        student?: { first_name: string; last_name: string | null; avatar_url: string | null };
        class?: { title: string };
      }[];
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
    stats?: { lessons_conducted: number; students_count: number },
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
      headline: t.headline ?? null,
      intro_video_url: t.intro_video_url ?? null,
      intro_video_poster: t.intro_video_poster ?? null,
      country: t.country ?? null,
      experience_years: t.experience_years ?? null,
      specializations: t.specializations ?? [],
      highlights: t.highlights ?? [],
      speaks: parseSpeaks(t.speaks),
      education: parseEducation(t.education),
      avg_rating: avgRating,
      ratings_count: ratingsCount,
      stars_breakdown: stars,
      level,
      lessons_conducted: stats?.lessons_conducted ?? 0,
      students_count: stats?.students_count ?? 0,
      badges: t.badges,
      classes: classesFormatted,
      recent_reviews: includeRecentRatings
        ? t.ratings
            .filter((r) => r.comment?.trim())
            .slice(0, 10)
            .map((r) => ({
              rating: r.rating,
              comment: r.comment,
              created_at: r.created_at ?? null,
              class_title: r.class?.title ?? null,
              author: r.student
                ? {
                    name: reviewerName(r.student.first_name, r.student.last_name),
                    avatar_url: r.student.avatar_url,
                  }
                : null,
            }))
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

    // Оценку можно ставить только после проведённого урока в этом классе.
    const conducted = await this.prisma.lesson.count({
      where: { class_id: data.class_id, status: 'COMPLETED' },
    });
    if (conducted === 0) {
      throw new ForbiddenException('LESSON_NOT_CONDUCTED');
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
  async updateProfile(userId: string, data: UpdateTeacherProfileDto) {
    const teacher = await this.prisma.teacher.findUnique({ where: { user_id: userId } });
    if (!teacher) throw new NotFoundException('Teacher profile not found');

    return this.prisma.teacher.update({
      where: { id: teacher.id },
      data: {
        bio: data.bio,
        photo_url: data.photo_url,
        website_url: data.website_url,
        instagram_url: data.instagram_url,
        telegram_url: data.telegram_url,
        headline: data.headline,
        intro_video_url: data.intro_video_url,
        intro_video_poster: data.intro_video_poster,
        country: data.country,
        experience_years: data.experience_years,
        // Массивы и Json перезаписываются целиком: форма редактирования шлёт
        // полный список, и точечное добавление здесь только запутало бы.
        specializations: data.specializations,
        // Раскладываем по полям, а не кладём объекты DTO целиком: в Json должна
        // попасть ровно описанная форма, а не то, что класс-валидатор оставил
        // на экземпляре.
        speaks: data.speaks?.map((s) => ({ name: s.name, level: s.level })),
        education: data.education?.map((e) => ({ title: e.title, org: e.org, year: e.year })),
      },
      select: {
        id: true,
        bio: true,
        photo_url: true,
        website_url: true,
        instagram_url: true,
        telegram_url: true,
        headline: true,
        intro_video_url: true,
        intro_video_poster: true,
        country: true,
        experience_years: true,
        specializations: true,
        highlights: true,
        speaks: true,
        education: true,
      },
    });
  }

  /**
   * PATCH /teachers/:teacherId/highlights — менеджер задаёт черты преподавателя.
   *
   * Отдельно от остального профиля и намеренно недоступно самому
   * преподавателю: «терпеливый» и «структурный» — это оценка со стороны, и
   * если её можно поставить себе самому, она перестаёт что-либо значить.
   */
  async setHighlights(teacherId: string, highlights: string[]) {
    const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    return this.prisma.teacher.update({
      where: { id: teacherId },
      data: {
        // Чистим до обрезки, иначе пустая строка занимает одно из шести мест
        // и вытесняет настоящую черту.
        highlights: highlights
          .map((h) => h.trim().slice(0, 40))
          .filter(Boolean)
          .slice(0, 6),
      },
      select: { id: true, highlights: true },
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
