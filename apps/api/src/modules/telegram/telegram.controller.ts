import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Headers,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Update } from 'grammy/types';

import { Public } from '../auth/decorators/public.decorator';
import { TelegramService } from './telegram.service';

/**
 * TelegramController — принимает webhook updates от Telegram.
 *
 * Эндпоинт публичный (@Public) — JWT guard пропускает.
 * Защита через секретный токен в заголовке X-Telegram-Bot-Api-Secret-Token.
 * Telegram сам добавляет этот заголовок если задать secret_token при setWebhook.
 */
@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  @Public()
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string,
    @Body() update: Update,
  ) {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');

    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    await this.telegramService.handleUpdate(update);
    return { ok: true };
  }

  /**
   * GET /telegram/diag?secret=... — диагностика бота/вебхука (реальный статус из Telegram).
   * Защита тем же секретом, что и вебхук. Помогает понять почему молчат хендлеры.
   */
  @Get('diag')
  @Public()
  async diag(@Query('secret') secret: string) {
    const expected = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!expected || secret !== expected) {
      throw new UnauthorizedException('Invalid secret');
    }
    return this.telegramService.getLiveStatus();
  }
}
