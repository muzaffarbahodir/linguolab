import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TelegramInitDataValidator } from './telegram-init.validator';
import { JwtStrategy } from './strategies/jwt.strategy';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * AuthModule — модуль аутентификации.
 *
 * Что регистрируем:
 * - PassportModule — базовая поддержка Passport.js стратегий
 * - JwtModule (без конфига) — конфиг токенов передаётся динамически в AuthService
 *   через jwtService.sign({ ... }, { secret, expiresIn }) для каждого типа токена.
 *   Это позволяет использовать разные секреты для access и refresh.
 * - JwtStrategy — Passport стратегия "jwt" (читает JWT_SECRET из ConfigService)
 * - TelegramInitDataValidator — HMAC проверка initData
 * - AuthService, AuthController
 * - NotificationsModule — для welcome-уведомления при первом логине
 *
 * PrismaService и RedisService доступны без импорта
 * (PrismaModule и RedisModule глобальные).
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({}), // пустой — секреты передаём явно в sign/verify
    NotificationsModule, // нужен для welcome-уведомления
  ],
  controllers: [AuthController],
  providers: [AuthService, TelegramInitDataValidator, JwtStrategy],
  exports: [AuthService, TelegramInitDataValidator],
})
export class AuthModule {}
