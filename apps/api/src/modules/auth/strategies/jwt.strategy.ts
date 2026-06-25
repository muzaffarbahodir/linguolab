import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

/** Payload внутри access JWT */
export interface JwtPayload {
  /** user.id (cuid) */
  sub: string;
  /** user.role */
  role: Role;
  /** token_version — при смене роли инкрементируется, старые JWT → 401 */
  tv: number;
  /** jti — уникальный ID токена (UUID v4) */
  jti: string;
}

/** Объект который попадает в req.user после проверки JWT */
export interface RequestUser {
  id: string;
  role: Role;
  tv: number;
  jti: string;
  /** Активирован ли менеджером. false = новый, ждёт подтверждения */
  is_active: boolean;
}

/**
 * JwtStrategy — Passport стратегия для проверки access JWT.
 *
 * Токен берётся из Authorization: Bearer <token> заголовка.
 * При валидном JWT:
 *   1. Проверяем что пользователь существует в БД
 *   2. Проверяем token_version (tv) — если юзеру сменили роль, tv != payload.tv → 401
 * Результат validate() попадает в req.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new Error('JWT_SECRET is not configured');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    // Проверяем что пользователь всё ещё существует и tv совпадает
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, token_version: true, is_active: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // token_version защита: если роль поменялась → tv != user.token_version → 401
    if (user.token_version !== payload.tv) {
      throw new UnauthorizedException('Token invalidated — please re-login');
    }

    return {
      id: user.id,
      role: user.role,
      tv: user.token_version,
      jti: payload.jti,
      is_active: user.is_active,
    };
  }
}
