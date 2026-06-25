import { SetMetadata } from '@nestjs/common';

/**
 * @Public() — помечает endpoint как публичный (без JWT).
 *
 * JwtAuthGuard читает этот метадату и пропускает запрос без проверки токена.
 *
 * Использование:
 *   @Public()
 *   @Post('/auth/telegram/init')
 *   telegramInit(@Body() dto: TelegramInitDto) {}
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
