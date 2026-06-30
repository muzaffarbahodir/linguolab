import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ClassStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateClassRequestDto } from './dto/create-class-request.dto';
import { ApproveClassRequestDto, RejectClassRequestDto } from './dto/review-class-request.dto';

const requestSelect = {
  id: true,
  title: true,
  level: true,
  description: true,
  schedule_days: true,
  schedule_time: true,
  schedule_duration: true,
  starts_at: true,
  ends_at: true,
  max_students: true,
  meeting_url: true,
  course_duration: true,
  course_includes: true,
  course_requirements: true,
  note: true,
  status: true,
  admin_note: true,
  created_at: true,
  updated_at: true,
  teacher: {
    select: {
      id: true,
      user: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
    },
  },
  language: { select: { id: true, name_ru: true, flag_emoji: true, code: true } },
  approved_class: { select: { id: true, title: true, status: true } },
} as const;

@Injectable()
export class ClassRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly redis: RedisService,
  ) {}

  // ─── Teacher: create ────────────────────────────────────────────────────────

  async create(teacherUserId: string, dto: CreateClassRequestDto) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { user_id: teacherUserId },
      select: { id: true },
    });
    if (!teacher) throw new ForbiddenException('Teacher profile not found');

    const language = await this.prisma.language.findUnique({
      where: { id: dto.language_id },
      select: { id: true },
    });
    if (!language) throw new NotFoundException('Language not found');

    const created = await this.prisma.classRequest.create({
      data: {
        teacher_id: teacher.id,
        language_id: dto.language_id,
        title: dto.title,
        level: dto.level,
        description: dto.description,
        schedule_days: dto.schedule_days,
        schedule_time: dto.schedule_time,
        schedule_duration: dto.schedule_duration,
        starts_at: dto.starts_at ? new Date(dto.starts_at) : undefined,
        ends_at: dto.ends_at ? new Date(dto.ends_at) : undefined,
        max_students: dto.max_students ?? 10,
        meeting_url: dto.meeting_url,
        course_duration: dto.course_duration,
        course_includes: dto.course_includes ?? [],
        course_requirements: dto.course_requirements ?? [],
        note: dto.note,
      },
      select: requestSelect,
    });

    const teacherName = `${created.teacher.user.first_name}${created.teacher.user.last_name ? ' ' + created.teacher.user.last_name : ''}`;
    void this.notifications.notifyStaffNewRequest(
      '📚 Заявка на открытие курса',
      `${teacherName} — ${created.title} (${created.language.name_ru})`,
      `classreq:${created.id}`,
    );

    return created;
  }

  // ─── Teacher: own requests ─────────────────────────────────────────────────

  async findMy(teacherUserId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { user_id: teacherUserId },
      select: { id: true },
    });
    if (!teacher) return [];

    return this.prisma.classRequest.findMany({
      where: { teacher_id: teacher.id },
      select: requestSelect,
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── Manager/Admin: all requests ───────────────────────────────────────────

  findAll(status?: string) {
    return this.prisma.classRequest.findMany({
      where: status ? { status: status as never } : {},
      select: requestSelect,
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    });
  }

  findOne(id: string) {
    return this.prisma.classRequest.findUnique({
      where: { id },
      select: requestSelect,
    });
  }

  // ─── Manager/Admin: approve ────────────────────────────────────────────────

  /**
   * Апрув заявки учителя:
   * 1. Создаёт Class в DRAFT (с обоими ценами, датами семестра)
   * 2. Назначает учителя на созданный класс
   * 3. Помечает request как APPROVED, ставит ссылку на класс
   * 4. Уведомляет учителя
   */
  async approve(requestId: string, dto: ApproveClassRequestDto) {
    const request = await this.prisma.classRequest.findUnique({
      where: { id: requestId },
      include: {
        teacher: { select: { id: true, user_id: true } },
        language: { select: { id: true } },
      },
    });
    if (!request) throw new NotFoundException('Class request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Can only approve PENDING requests');
    }

    // Создаём Class в DRAFT (учитель и менеджер потом открывают запись вручную)
    const newClass = await this.prisma.class.create({
      data: {
        language_id: request.language_id,
        teacher_id: request.teacher.id,
        title: request.title,
        level: dto.level ?? request.level,
        description: request.description,
        price_uzs: dto.price_uzs,
        price_usd: dto.price_usd,
        max_students: dto.max_students ?? request.max_students,
        meeting_url: dto.meeting_url ?? request.meeting_url ?? undefined,
        schedule_days: dto.schedule_days ?? request.schedule_days,
        schedule_time: dto.schedule_time ?? request.schedule_time ?? undefined,
        schedule_duration: dto.schedule_duration ?? request.schedule_duration ?? undefined,
        status: ClassStatus.DRAFT,
        semester_label: dto.semester_label ?? undefined,
        enrollment_opens_at: dto.enrollment_opens_at
          ? new Date(dto.enrollment_opens_at)
          : undefined,
        enrollment_closes_at: dto.enrollment_closes_at
          ? new Date(dto.enrollment_closes_at)
          : undefined,
        starts_at: dto.starts_at ? new Date(dto.starts_at) : (request.starts_at ?? undefined),
        ends_at: dto.ends_at ? new Date(dto.ends_at) : (request.ends_at ?? undefined),
        is_active: false, // станет true когда откроют запись
      },
      select: { id: true, title: true },
    });

    // Помечаем request APPROVED + ссылка на класс
    const updated = await this.prisma.classRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        admin_note: dto.admin_note,
        approved_class_id: newClass.id,
      },
      select: requestSelect,
    });

    // Первый учитель определяет инфо направления (курса): заполняем поля
    // Language если они ещё пусты. Так "создал курс" = задал инфо, а
    // "присоединился к готовому направлению" = инфо уже есть, не трогаем.
    const lang = await this.prisma.language.findUnique({
      where: { id: request.language_id },
      select: { duration_label: true, includes: true, requirements: true },
    });
    if (lang) {
      const data: { duration_label?: string; includes?: string[]; requirements?: string[] } = {};
      if (!lang.duration_label && request.course_duration) {
        data.duration_label = request.course_duration;
      }
      if (!lang.includes?.length && request.course_includes.length) {
        data.includes = request.course_includes;
      }
      if (!lang.requirements?.length && request.course_requirements.length) {
        data.requirements = request.course_requirements;
      }
      if (Object.keys(data).length) {
        await this.prisma.language.update({ where: { id: request.language_id }, data });
        await this.redis.del('cache:languages');
      }
    }

    // TODO: notify teacher via Telegram (нужен тип уведомления CLASS_REQUEST_APPROVED)
    // void this.notifications.scheduleClassRequestApproved(request.teacher.user_id, newClass.title);

    return updated;
  }

  // ─── Manager/Admin: reject ─────────────────────────────────────────────────

  async reject(requestId: string, dto: RejectClassRequestDto) {
    const request = await this.prisma.classRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    });
    if (!request) throw new NotFoundException('Class request not found');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Can only reject PENDING requests');
    }

    return this.prisma.classRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', admin_note: dto.admin_note },
      select: requestSelect,
    });
  }
}
