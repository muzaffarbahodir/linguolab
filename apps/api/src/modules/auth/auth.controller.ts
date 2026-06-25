import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { TelegramInitDto } from './dto/telegram-init.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestUser } from './strategies/jwt.strategy';

/**
 * AuthController — 4 эндпоинта аутентификации.
 *
 * Все под /api/v1/auth (global prefix из main.ts).
 *
 * POST /auth/telegram/init  — публичный, для TWA
 * POST /auth/refresh         — публичный, для Admin NextAuth
 * POST /auth/admin/login     — публичный, email+password для MANAGER+
 * POST /auth/logout          — требует JWT (для Admin)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/telegram/init
   *
   * Тело: { initData: string }  — строка от WebApp.initData
   *
   * Ответ: { access_token, refresh_token, user }
   *
   * TWA вызывает этот endpoint при монтировании App.tsx.
   * refresh_token для TWA не используется — при 401 просто повторяем init.
   */
  @Public()
  @Post('telegram/init')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60_000 }, medium: { limit: 10, ttl: 60_000 } })
  async telegramInit(@Body() dto: TelegramInitDto) {
    return this.authService.telegramInit(dto.initData);
  }

  /**
   * POST /api/v1/auth/refresh
   *
   * Тело: { refresh_token: string }
   *
   * Ответ: { access_token, refresh_token }
   *
   * Используется Admin (NextAuth) для обновления сессии.
   * TWA не использует (401 → re-init через WebApp.initData).
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refresh_token);
  }

  /**
   * POST /api/v1/auth/admin/login
   *
   * Тело: { email: string, password: string }
   *
   * Ответ: { access_token, refresh_token, user }
   *
   * Только для MANAGER | ADMIN | SUPER_ADMIN.
   * STUDENT/TEACHER/PARENT → 403 Forbidden.
   */
  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto.email, dto.password);
  }

  /**
   * POST /api/v1/auth/logout
   *
   * Тело: { refresh_token: string }
   *
   * Отзывает refresh токен из Redis.
   * Access токен истечёт сам через 15 минут.
   * Требует JWT (JwtAuthGuard глобально).
   */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() _user: RequestUser, // гарантирует что JwtAuthGuard отработал
    @Body() dto: RefreshDto,
  ) {
    await this.authService.logout(dto.refresh_token);
  }
}
