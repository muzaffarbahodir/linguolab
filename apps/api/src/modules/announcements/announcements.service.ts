import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AnnouncementStyle,
  AnnouncementPosition,
  AnnouncementRecurrence,
  Role,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';

const CACHE_KEY = 'cache:announcements:active';
const CACHE_TTL = 60; // 1 минута
const BROADCAST_CAP = 5000; // защита от перегрузки очереди

export interface UpsertAnnouncementDto {
  text?: string;
  style?: AnnouncementStyle;
  position?: AnnouncementPosition;
  is_active?: boolean;
  sort_order?: number;
  /** Длительность показа в минутах. 0/undefined = бессрочно. */
  duration_minutes?: number;
  /** Роли-получатели (пусто = все). */
  audience_roles?: Role[];
  /** Конкретный пользователь (приоритет над ролями). */
  target_user_id?: string | null;
  /** Конкретный пользователь по @username — резолвим в target_user_id. '' = снять. */
  target_username?: string;
  recurrence?: AnnouncementRecurrence;
  recurrence_day?: number | null;
  /** При создании: также отправить в чат бота + in-app уведомление. */
  broadcast?: boolean;
}

interface ActiveItem {
  id: string;
  text: string;
  style: AnnouncementStyle;
  position: AnnouncementPosition;
  audience_roles: Role[];
  target_user_id: string | null;
}

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Активные баннеры для бегущей строки конкретного пользователя.
   * Фильтр: не истёк + (адресован лично ему ИЛИ его роль входит в аудиторию ИЛИ аудитория пустая).
   */
  async findActive(role: Role, userId: string) {
    let all: ActiveItem[];
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      all = JSON.parse(cached) as ActiveItem[];
    } else {
      all = await this.prisma.announcement.findMany({
        where: {
          is_active: true,
          OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
        select: {
          id: true,
          text: true,
          style: true,
          position: true,
          audience_roles: true,
          target_user_id: true,
        },
      });
      void this.redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(all));
    }

    return all
      .filter((a) => {
        if (a.target_user_id) return a.target_user_id === userId;
        if (!a.audience_roles.length) return true;
        return a.audience_roles.includes(role);
      })
      .map(({ id, text, style, position }) => ({ id, text, style, position }));
  }

  /** Все баннеры для панели (+ @username адресата для префилла формы). */
  async findAllAdmin() {
    const rows = await this.prisma.announcement.findMany({
      orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
    });
    const ids = rows.map((r) => r.target_user_id).filter((x): x is string => !!x);
    const users = ids.length
      ? await this.prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, telegram_username: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u.telegram_username]));
    return rows.map((r) => ({
      ...r,
      target_username: r.target_user_id ? (byId.get(r.target_user_id) ?? null) : null,
    }));
  }

  async create(dto: UpsertAnnouncementDto) {
    const targetUserId = await this.resolveTargetUserId(dto);
    const created = await this.prisma.announcement.create({
      data: {
        text: dto.text ?? '',
        style: dto.style ?? AnnouncementStyle.CAUTION,
        position: dto.position ?? AnnouncementPosition.TOP,
        is_active: dto.is_active ?? true,
        sort_order: dto.sort_order ?? 0,
        duration_minutes:
          dto.duration_minutes && dto.duration_minutes > 0 ? dto.duration_minutes : null,
        expires_at: this.computeExpiry(dto.duration_minutes),
        audience_roles: dto.audience_roles ?? [],
        target_user_id: targetUserId ?? null,
        recurrence: dto.recurrence ?? AnnouncementRecurrence.NONE,
        recurrence_day: dto.recurrence_day ?? null,
      },
    });
    await this.bust();

    if (dto.broadcast && created.text.trim()) {
      void this.deliverBroadcast(created.text, created.audience_roles, created.target_user_id);
    }

    return created;
  }

  async update(id: string, dto: UpsertAnnouncementDto) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');

    const targetUserId = await this.resolveTargetUserId(dto);

    const updated = await this.prisma.announcement.update({
      where: { id },
      data: {
        ...(dto.text !== undefined ? { text: dto.text } : {}),
        ...(dto.style !== undefined ? { style: dto.style } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
        ...(dto.sort_order !== undefined ? { sort_order: dto.sort_order } : {}),
        ...(dto.duration_minutes !== undefined
          ? {
              duration_minutes: dto.duration_minutes > 0 ? dto.duration_minutes : null,
              expires_at: this.computeExpiry(dto.duration_minutes),
            }
          : {}),
        ...(dto.audience_roles !== undefined ? { audience_roles: dto.audience_roles } : {}),
        ...(targetUserId !== undefined ? { target_user_id: targetUserId } : {}),
        ...(dto.recurrence !== undefined ? { recurrence: dto.recurrence } : {}),
        ...(dto.recurrence_day !== undefined ? { recurrence_day: dto.recurrence_day } : {}),
      },
    });
    await this.bust();
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    await this.prisma.announcement.delete({ where: { id } });
    await this.bust();
    return { ok: true };
  }

  /**
   * Регулярные объявления — ежедневная проверка в 04:00 UTC (09:00 UTC+5).
   * Если сегодня совпадает с расписанием → реактивируем (обновляем окно показа)
   * и рассылаем в чат + уведомления выбранной аудитории.
   */
  @Cron('0 4 * * *')
  async runRecurring() {
    const now = new Date();
    const dow = now.getUTCDay(); // 0-6
    const dom = now.getUTCDate(); // 1-31

    const recurring = await this.prisma.announcement.findMany({
      where: { recurrence: { not: AnnouncementRecurrence.NONE } },
    });

    let fired = 0;
    for (const a of recurring) {
      const match =
        a.recurrence === AnnouncementRecurrence.DAILY ||
        (a.recurrence === AnnouncementRecurrence.WEEKLY && a.recurrence_day === dow) ||
        (a.recurrence === AnnouncementRecurrence.MONTHLY && a.recurrence_day === dom);
      if (!match) continue;

      // Окно показа: длительность или до конца дня.
      const expires = a.duration_minutes
        ? new Date(Date.now() + a.duration_minutes * 60_000)
        : new Date(new Date().setUTCHours(23, 59, 59, 0));

      await this.prisma.announcement.update({
        where: { id: a.id },
        data: { is_active: true, expires_at: expires },
      });

      if (a.text.trim()) {
        void this.deliverBroadcast(a.text, a.audience_roles, a.target_user_id);
      }
      fired++;
    }

    if (fired > 0) {
      await this.bust();
      this.logger.log(`Recurring announcements fired: ${fired}`);
    }
  }

  // ─── Private ──────────────────────────────────────────────────────────────────

  /**
   * Резолвит адресата:
   *  - target_username задан → ищем по @username (пусто = снять, null)
   *  - иначе target_user_id если передан
   *  - иначе undefined (не менять)
   */
  private async resolveTargetUserId(
    dto: UpsertAnnouncementDto,
  ): Promise<string | null | undefined> {
    if (dto.target_username !== undefined) {
      const uname = dto.target_username.trim().replace(/^@/, '');
      if (!uname) return null;
      const u = await this.prisma.user.findFirst({
        where: { telegram_username: uname },
        select: { id: true },
      });
      if (!u) throw new BadRequestException(`Пользователь @${uname} не найден`);
      return u.id;
    }
    if (dto.target_user_id !== undefined) return dto.target_user_id;
    return undefined;
  }

  private computeExpiry(durationMinutes?: number): Date | null {
    if (!durationMinutes || durationMinutes <= 0) return null;
    return new Date(Date.now() + durationMinutes * 60_000);
  }

  /**
   * Шлёт текст выбранной аудитории в Telegram-чат + in-app уведомление
   * (NotificationsService → BullMQ → processor отправляет оба канала).
   */
  private async deliverBroadcast(text: string, audienceRoles: Role[], targetUserId: string | null) {
    const where: Prisma.UserWhereInput = { tg_blocked: false };
    if (targetUserId) {
      where.id = targetUserId;
    } else if (audienceRoles.length) {
      where.role = { in: audienceRoles };
    }

    const users = await this.prisma.user.findMany({
      where,
      select: { id: true },
      take: BROADCAST_CAP,
    });

    for (const u of users) {
      void this.notifications.send({
        userId: u.id,
        type: NotificationType.BROADCAST,
        title: '📢 Объявление',
        body: text,
      });
    }
    this.logger.log(`Announcement broadcast queued to ${users.length} users`);
  }

  private async bust() {
    await this.redis.del(CACHE_KEY);
  }
}
