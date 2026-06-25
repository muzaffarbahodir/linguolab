import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { TelegramInitDataValidator } from './telegram-init.validator';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';
import { AnalyticsService } from '../analytics/analytics.service';
import type { JwtPayload } from './strategies/jwt.strategy';

/** Роли которые могут логиниться через /auth/admin/login */
const ADMIN_PANEL_ROLES: Role[] = [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN];

/** Ответ с парой токенов */
export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

/** Публичные данные пользователя для ответа */
export interface UserPublic {
  id: string;
  telegram_user_id: string; // BigInt → string (JSON serialization)
  first_name: string;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  role: Role;
  is_active: boolean;
  locale: string;
  timezone: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: UserPublic;
}

/**
 * AuthService — бизнес-логика аутентификации.
 *
 * Три флоу:
 * 1. telegramInit(initData) — для TWA (STUDENT/TEACHER/PARENT)
 * 2. adminLogin(email, password) — для MANAGER/ADMIN/SUPER_ADMIN
 * 3. refresh(refreshToken) — обновление пары токенов (только Admin)
 *
 * Refresh token хранится в Redis:
 *   Key:   refresh:<jti>
 *   Value: JSON { userId, tv, familyId }
 *   TTL:   JWT_REFRESH_TTL (30 days)
 *
 * Rotation chain + reuse detection:
 *   При refresh — старый токен удаляется, выдаётся новый с тем же familyId.
 *   Если старый токен уже удалён (повторное использование) — revoke весь family.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /** TTL refresh токена в секундах (из JWT_REFRESH_TTL = "30d") */
  private readonly refreshTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly telegramValidator: TelegramInitDataValidator,
    private readonly notifications: NotificationsService,
    private readonly analytics: AnalyticsService,
  ) {
    // Парсим "30d" → 30 * 86400 секунд
    const ttlStr = this.config.get<string>('JWT_REFRESH_TTL', '30d');
    this.refreshTtlSeconds = this.parseTtlToSeconds(ttlStr);
  }

  // ----------------------------------------------------------------
  // PUBLIC METHODS
  // ----------------------------------------------------------------

  /**
   * telegramInit — авторизация через Telegram WebApp.initData.
   *
   * 1. Валидирует HMAC подпись + auth_date
   * 2. Upsert пользователя в БД (создаёт при первом входе, обновляет при повторном)
   * 3. Bootstrap SUPER_ADMIN: если telegram_user_id в SUPER_ADMIN_TELEGRAM_IDS — апгрейд роли
   * 4. Уведомляет менеджеров при регистрации нового пользователя
   * 5. Выдаёт access + refresh токены
   */
  async telegramInit(initData: string): Promise<AuthResponse> {
    // Шаг 1: Валидация initData
    const { telegramUser } = this.telegramValidator.validate(initData);

    // Шаг 2: Определяем — новый пользователь или возвращающийся
    const existing = await this.prisma.user.findUnique({
      where: { telegram_user_id: telegramUser.id },
      select: { id: true },
    });
    const isNewUser = !existing;

    // Шаг 3: Upsert пользователя
    // telegram_user_id — первичный идентификатор для TWA
    // Новые пользователи: is_active = false (ждут подтверждения менеджера)
    // Исключение: SUPER_ADMIN из env активируются автоматически (шаг 3.5)
    const superAdminIds = this.parseSuperAdminIds();
    const isSuperAdminBootstrap = superAdminIds.has(telegramUser.id);

    let user = await this.prisma.user.upsert({
      where: { telegram_user_id: telegramUser.id },
      create: {
        telegram_user_id: telegramUser.id,
        telegram_username: telegramUser.username ?? null,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name ?? null,
        avatar_url: telegramUser.photo_url ?? null,
        locale: telegramUser.language_code ?? 'ru',
        // SUPER_ADMIN из env активируются сразу
        is_active: isSuperAdminBootstrap,
        role: isSuperAdminBootstrap ? Role.SUPER_ADMIN : Role.STUDENT,
      },
      update: {
        // Обновляем данные которые могли измениться в Telegram профиле
        telegram_username: telegramUser.username ?? null,
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name ?? null,
        avatar_url: telegramUser.photo_url ?? null,
        last_active_at: new Date(),
      },
    });

    // Шаг 3.5: Bootstrap — если существующий юзер ещё не SUPER_ADMIN, апгрейдим
    if (isSuperAdminBootstrap && user.role !== Role.SUPER_ADMIN) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          role: Role.SUPER_ADMIN,
          is_active: true,
          token_version: { increment: 1 },
        },
      });
      this.logger.log(`Bootstrap: upgraded user ${user.id} (tg:${telegramUser.id}) to SUPER_ADMIN`);
    }

    // Шаг 4: Действия при первом логине (только не-супер-админы)
    if (isNewUser && !isSuperAdminBootstrap) {
      // Welcome-уведомление новому пользователю
      void this.notifications.scheduleWelcome(user.id, user.first_name);
      // Уведомление менеджеров о новой заявке
      void this.notifyManagersNewUser(user);
    }

    // Шаг 5: Выдаём токены
    const tokens = await this.issueTokenPair(user.id, user.role, user.token_version);

    // Трекинг логина (fire-and-forget)
    void this.analytics.track('login', {
      userId: user.id,
      userRole: user.role,
      properties: { is_new: isNewUser },
    });

    return {
      ...tokens,
      user: this.toUserPublic(user),
    };
  }

  /**
   * Парсит SUPER_ADMIN_TELEGRAM_IDS из env.
   * Формат: "123456789,987654321" (через запятую, без пробелов)
   * Возвращает Set<bigint> для O(1) lookup.
   */
  private parseSuperAdminIds(): Set<bigint> {
    const raw = this.config.get<string>('SUPER_ADMIN_TELEGRAM_IDS', '');
    const ids = new Set<bigint>();
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      try {
        ids.add(BigInt(trimmed));
      } catch {
        this.logger.warn(`SUPER_ADMIN_TELEGRAM_IDS: invalid value "${trimmed}" (not a bigint)`);
      }
    }
    return ids;
  }

  /**
   * Уведомляет всех MANAGER/ADMIN о новом зарегистрированном пользователе.
   * Использует BullMQ очередь (notifications.send) — fire-and-forget.
   */
  private async notifyManagersNewUser(newUser: {
    id: string;
    first_name: string;
    last_name: string | null;
    telegram_username: string | null;
    telegram_user_id: bigint;
    role: Role;
  }): Promise<void> {
    try {
      const managers = await this.prisma.user.findMany({
        where: {
          role: { in: [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN] },
          is_active: true,
        },
        select: { id: true },
      });

      if (managers.length === 0) return;

      const fullName = [newUser.first_name, newUser.last_name].filter(Boolean).join(' ');
      const usernameHint = newUser.telegram_username ? ` (@${newUser.telegram_username})` : '';
      const twaUrl = this.config.get<string>(
        'TELEGRAM_WEB_APP_URL',
        'https://app-linguolab.muzaffarbahodir.uz',
      );

      const body =
        `🆕 <b>Новая заявка в LinguoLab</b>\n\n` +
        `👤 ${fullName}${usernameHint}\n` +
        `🆔 tg_id: <code>${newUser.telegram_user_id.toString()}</code>\n\n` +
        `Активируйте пользователя в <a href="${twaUrl}/admin/users">приложении LinguoLab</a>.`;

      await Promise.allSettled(
        managers.map((m) =>
          this.notifications.send({
            userId: m.id,
            type: NotificationType.BROADCAST,
            title: '🆕 Новая заявка',
            body,
            // Не дедупируем — каждая заявка уникальна
            dedupKey: `notif:dedup:new_user:${newUser.id}:mgr:${m.id}`,
            dedupTtlSec: 86_400,
            payload: { newUserId: newUser.id },
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(`notifyManagersNewUser failed: ${String(err)}`);
    }
  }

  /**
   * adminLogin — логин по email+password для MANAGER/ADMIN/SUPER_ADMIN.
   * STUDENT/TEACHER/PARENT не могут залогиниться сюда (403).
   */
  async adminLogin(email: string, password: string): Promise<AuthResponse> {
    // Ищем пользователя по email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password_hash) {
      // Одинаковая ошибка для "не найден" и "нет пароля" — защита от user enumeration
      throw new UnauthorizedException('Invalid credentials');
    }

    // Проверяем роль (только admin-панельные роли)
    if (!ADMIN_PANEL_ROLES.includes(user.role)) {
      throw new ForbiddenException('Admin panel access denied for this role');
    }

    // bcrypt.compare — timing-safe (постоянное время независимо от результата)
    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokenPair(user.id, user.role, user.token_version);

    return {
      ...tokens,
      user: this.toUserPublic(user),
    };
  }

  /**
   * refresh — обмен refresh токена на новую пару.
   *
   * Rotation chain:
   *   - Проверяем refresh_token в Redis
   *   - Если не найден → возможно reuse attack → revoke family
   *   - Если найден → удаляем старый, выдаём новый с тем же familyId
   *   - Проверяем token_version для защиты от смены роли
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    // Верифицируем JWT подпись refresh токена
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }

    const redisKey = `refresh:${payload.jti}`;

    // Читаем из Redis
    const storedRaw = await this.redis.get(redisKey);
    if (!storedRaw) {
      // Токен не найден в Redis:
      //   - Либо истёк TTL
      //   - Либо уже был использован (reuse attack!) → revoke весь family
      this.logger.warn(`Refresh token reuse detected for user ${payload.sub}, revoking family`);
      await this.revokeFamily(payload.sub);
      throw new UnauthorizedException('Refresh token already used — please re-login');
    }

    const stored: { userId: string; tv: number; familyId: string } = JSON.parse(storedRaw);

    // Проверяем token_version (защита от смены роли)
    const user = await this.prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, role: true, token_version: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.token_version !== stored.tv) {
      // Роль поменялась — весь family невалиден
      await this.redis.del(redisKey);
      throw new UnauthorizedException('Session invalidated — please re-login');
    }

    // Удаляем старый refresh токен (rotation)
    await this.redis.del(redisKey);

    // Выдаём новую пару с тем же familyId
    return this.issueTokenPair(user.id, user.role, user.token_version, stored.familyId);
  }

  /**
   * logout — отзывает refresh токен.
   * Access токен истечёт сам (15 минут).
   */
  async logout(refreshToken: string): Promise<void> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      // Если токен уже невалиден — всё равно OK
      return;
    }
    await this.redis.del(`refresh:${payload.jti}`);
  }

  // ----------------------------------------------------------------
  // PRIVATE HELPERS
  // ----------------------------------------------------------------

  /**
   * issueTokenPair — выдаёт access + refresh JWT пару.
   *
   * Access: подписан JWT_SECRET, TTL JWT_ACCESS_TTL (15m)
   * Refresh: подписан JWT_REFRESH_SECRET, TTL JWT_REFRESH_TTL (30d)
   *          Сохраняется в Redis с TTL.
   */
  private async issueTokenPair(
    userId: string,
    role: Role,
    tv: number,
    existingFamilyId?: string,
  ): Promise<TokenPair> {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();
    const familyId = existingFamilyId ?? uuidv4(); // Новая family для первого логина

    const basePayload = { sub: userId, role, tv };

    // Access token (короткоживущий, 15 минут)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const access_token = this.jwtService.sign({ ...basePayload, jti: accessJti } as any, {
      secret: this.config.get<string>('JWT_SECRET'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as any,
    });

    // Refresh token (долгоживущий, 30 дней)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refresh_token = this.jwtService.sign({ ...basePayload, jti: refreshJti } as any, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.config.get<string>('JWT_REFRESH_TTL', '30d') as any,
    });

    // Сохраняем refresh в Redis
    // Key: refresh:<jti>  Value: JSON { userId, tv, familyId }  TTL: 30d
    await this.redis.setex(
      `refresh:${refreshJti}`,
      this.refreshTtlSeconds,
      JSON.stringify({ userId, tv, familyId }),
    );

    return { access_token, refresh_token };
  }

  /**
   * revokeFamily — отзывает все refresh токены одного пользователя.
   * Используется при обнаружении reuse attack.
   * Ищет все ключи refresh:* и удаляет те что принадлежат userId.
   *
   * NOTE: SCAN-based итерация — безопасна для большого Redis (не блокирует).
   */
  private async revokeFamily(userId: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        'refresh:*',
        'COUNT',
        '100',
      );
      cursor = nextCursor;

      for (const key of keys) {
        const raw = await this.redis.get(key);
        if (!raw) continue;

        try {
          const stored: { userId: string } = JSON.parse(raw);
          if (stored.userId === userId) {
            await this.redis.del(key);
          }
        } catch {
          // Невалидный JSON → пропускаем
        }
      }
    } while (cursor !== '0');

    this.logger.warn(`Revoked all refresh tokens for user ${userId}`);
  }

  /**
   * toUserPublic — преобразует Prisma User в публичный объект для ответа.
   * BigInt (telegram_user_id) сериализуем в string — JSON.stringify не умеет BigInt.
   */
  private toUserPublic(user: {
    id: string;
    telegram_user_id: bigint;
    first_name: string;
    last_name: string | null;
    telegram_username: string | null;
    avatar_url: string | null;
    role: Role;
    is_active: boolean;
    locale: string;
    timezone: string;
  }): UserPublic {
    return {
      id: user.id,
      telegram_user_id: user.telegram_user_id.toString(), // BigInt → string
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.telegram_username,
      avatar_url: user.avatar_url,
      role: user.role,
      is_active: user.is_active,
      locale: user.locale,
      timezone: user.timezone,
    };
  }

  /**
   * parseTtlToSeconds — парсит строку TTL вида "15m", "30d", "1h" в секунды.
   */
  private parseTtlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 30 * 86_400; // default 30 дней

    const value = parseInt(match[1]!, 10);
    const unit = match[2]!;

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3_600,
      d: 86_400,
    };

    return value * (multipliers[unit] ?? 86_400);
  }
}
