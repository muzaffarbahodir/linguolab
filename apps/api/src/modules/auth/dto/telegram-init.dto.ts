import { IsString, IsNotEmpty } from 'class-validator';

/**
 * DTO для POST /auth/telegram/init
 *
 * initData — строка query-параметров от Telegram WebApp.
 * Формат: "auth_date=...&hash=...&user=...&..."
 * Верификация HMAC-SHA256 происходит в TelegramInitDataValidator.
 */
export class TelegramInitDto {
  @IsString()
  @IsNotEmpty()
  initData!: string;
}
