import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/** Распарсенный user из Telegram initData */
export interface TelegramUser {
  id: bigint;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

/** Результат валидации initData */
export interface ValidatedInitData {
  telegramUser: TelegramUser;
  authDate: Date;
}

/**
 * TelegramInitDataValidator — проверяет подпись initData от Telegram WebApp.
 *
 * Алгоритм (документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
 *
 * 1. Распарсить initData как URL query string → Map<key, value>
 * 2. Извлечь hash из Map, удалить его оттуда
 * 3. Отсортировать оставшиеся пары по ключу alphabetically
 * 4. Собрать data_check_string = "key=value\nkey=value\n..." (каждая пара через \n)
 * 5. secret_key = HMAC_SHA256(key="WebAppData", data=BOT_TOKEN)
 * 6. calc_hash  = HMAC_SHA256(key=secret_key, data=data_check_string) → hex
 * 7. timingSafeEqual(calc_hash, hash) — защита от timing attacks
 * 8. Проверить auth_date: now - auth_date <= 86400 секунд (24 часа)
 * 9. Распарсить JSON из поля "user"
 */
@Injectable()
export class TelegramInitDataValidator {
  /** Максимальный возраст initData — 24 часа в секундах */
  private static readonly MAX_AGE_SECONDS = 86_400;

  private readonly secretKey: Buffer;

  constructor(private readonly config: ConfigService) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }
    // secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)
    // Вычисляем один раз при инициализации сервиса (не на каждый запрос)
    this.secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  }

  /**
   * Проверяет initData строку от Telegram и возвращает данные пользователя.
   * Бросает UnauthorizedException если подпись неверна или initData просрочена.
   */
  validate(initData: string): ValidatedInitData {
    // 1. Парсим как URL query string
    const params = new URLSearchParams(initData);

    // 2. Извлекаем hash и удаляем из Map
    const receivedHash = params.get('hash');
    if (!receivedHash) {
      throw new UnauthorizedException('initData missing hash');
    }
    params.delete('hash');

    // 3-4. Сортируем alphabetically и собираем data_check_string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // 6. Вычисляем ожидаемый hash
    // Используем заранее вычисленный secretKey (не bot_token, а HMAC от "WebAppData")
    const calculatedHashBuffer = crypto
      .createHmac('sha256', this.secretKey)
      .update(dataCheckString)
      .digest();

    const receivedHashBuffer = Buffer.from(receivedHash, 'hex');

    // 7. Timing-safe сравнение — защита от timing attacks
    // Буферы должны быть одинаковой длины, иначе timingSafeEqual бросает
    if (
      calculatedHashBuffer.length !== receivedHashBuffer.length ||
      !crypto.timingSafeEqual(calculatedHashBuffer, receivedHashBuffer)
    ) {
      throw new UnauthorizedException('initData signature invalid');
    }

    // 8. Проверяем auth_date (в секундах, не миллисекундах — это формат Telegram)
    const authDateRaw = params.get('auth_date');
    if (!authDateRaw) {
      throw new UnauthorizedException('initData missing auth_date');
    }
    const authDateSeconds = parseInt(authDateRaw, 10);
    if (isNaN(authDateSeconds)) {
      throw new UnauthorizedException('initData auth_date is not a number');
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (authDateSeconds > nowSeconds + 60) {
      throw new UnauthorizedException('initData auth_date is in the future');
    }
    if (nowSeconds - authDateSeconds > TelegramInitDataValidator.MAX_AGE_SECONDS) {
      throw new UnauthorizedException('initData expired (older than 24 hours)');
    }

    // 9. Парсим поле user (JSON строка)
    const userRaw = params.get('user');
    if (!userRaw) {
      throw new UnauthorizedException('initData missing user field');
    }

    let tgUserData: Record<string, unknown>;
    try {
      tgUserData = JSON.parse(userRaw) as Record<string, unknown>;
    } catch {
      throw new UnauthorizedException('initData user field is not valid JSON');
    }

    if (!tgUserData['id'] || !tgUserData['first_name']) {
      throw new UnauthorizedException('initData user missing required fields');
    }

    const telegramUser: TelegramUser = {
      // id приходит как number от Telegram, преобразуем в BigInt
      // (Telegram user ID может превышать Number.MAX_SAFE_INTEGER)
      id: BigInt(tgUserData['id'] as number),
      first_name: String(tgUserData['first_name']),
      last_name: tgUserData['last_name'] ? String(tgUserData['last_name']) : undefined,
      username: tgUserData['username'] ? String(tgUserData['username']) : undefined,
      photo_url: tgUserData['photo_url'] ? String(tgUserData['photo_url']) : undefined,
      language_code: tgUserData['language_code'] ? String(tgUserData['language_code']) : undefined,
    };

    return {
      telegramUser,
      authDate: new Date(authDateSeconds * 1000),
    };
  }
}
