/**
 * Unit тесты для TelegramInitDataValidator.
 *
 * Стратегия тестирования:
 * - Генерируем валидный initData с тестовым bot_token
 * - Проверяем happy path и все кейсы ошибок
 * - Никакого SKIP_VALIDATION — тестируем реальный алгоритм
 *
 * Тестовый bot_token: "test_bot_token_123" (не реальный)
 * Тестовый user_id: 123456789
 */

import * as crypto from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TelegramInitDataValidator } from '../telegram-init.validator';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — генерация валидного initData для тестов
// ─────────────────────────────────────────────────────────────────────────────

const TEST_BOT_TOKEN = 'test_bot_token_for_unit_tests';

/**
 * generateValidInitData — создаёт корректно подписанную строку initData.
 *
 * Алгоритм идентичен тому что делает Telegram:
 * 1. Собираем поля (кроме hash), сортируем, join "\n"
 * 2. secret_key = HMAC_SHA256("WebAppData", bot_token)
 * 3. hash = HMAC_SHA256(secret_key, data_check_string).hex
 * 4. Добавляем hash в итоговую строку
 */
function generateValidInitData(
  overrides: {
    auth_date?: number;
    userId?: number;
    firstName?: string;
    lastName?: string;
    username?: string;
  } = {},
): string {
  const now = Math.floor(Date.now() / 1000);

  const authDate = overrides.auth_date ?? now;
  const userId = overrides.userId ?? 123456789;
  const firstName = overrides.firstName ?? 'Test';
  const lastName = overrides.lastName;
  const username = overrides.username ?? 'testuser';

  const userObj: Record<string, unknown> = {
    id: userId,
    first_name: firstName,
    allows_write_to_pm: true,
    language_code: 'ru',
  };
  if (lastName) userObj['last_name'] = lastName;
  if (username) userObj['username'] = username;

  // Поля initData (без hash)
  const fields: Array<[string, string]> = [
    ['auth_date', String(authDate)],
    ['user', JSON.stringify(userObj)],
  ];

  // Сортируем alphabetically (как требует Telegram)
  fields.sort(([a], [b]) => a.localeCompare(b));

  const dataCheckString = fields.map(([k, v]) => `${k}=${v}`).join('\n');

  // Вычисляем hash
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // Собираем итоговую строку (fields + hash)
  const params = new URLSearchParams(fields);
  params.set('hash', hash);

  return params.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// ТЕСТЫ
// ─────────────────────────────────────────────────────────────────────────────

describe('TelegramInitDataValidator', () => {
  let validator: TelegramInitDataValidator;

  beforeEach(() => {
    const mockConfig = {
      get: (key: string) => {
        if (key === 'TELEGRAM_BOT_TOKEN') return TEST_BOT_TOKEN;
        return undefined;
      },
    } as unknown as ConfigService;

    validator = new TelegramInitDataValidator(mockConfig);
  });

  // ──────────────────────────────────────────────────────────
  // HAPPY PATH
  // ──────────────────────────────────────────────────────────

  describe('Happy path', () => {
    it('валидный initData → возвращает TelegramUser', () => {
      const initData = generateValidInitData({
        userId: 42,
        firstName: 'Muzaffar',
        lastName: 'Bahodir',
        username: 'muzaffar_dev',
      });

      const result = validator.validate(initData);

      expect(result.telegramUser).toMatchObject({
        id: BigInt(42),
        first_name: 'Muzaffar',
        last_name: 'Bahodir',
        username: 'muzaffar_dev',
      });
      expect(result.authDate).toBeInstanceOf(Date);
    });

    it('BigInt корректно преобразован из number', () => {
      // Number.MAX_SAFE_INTEGER = 9007199254740991 — максимальное точно представимое целое.
      // Telegram user_id реально приходит как JSON number, валидатор делает BigInt(id).
      const bigId = Number.MAX_SAFE_INTEGER;

      const initData = generateValidInitData({ userId: bigId });
      const result = validator.validate(initData);

      expect(result.telegramUser.id).toBe(BigInt(bigId));
    });

    it('пользователь без username — поле undefined', () => {
      // Генерируем вручную без поля username в user-объекте
      const now = Math.floor(Date.now() / 1000);
      const userObj = { id: 99, first_name: 'Anonymous', language_code: 'ru' };
      const fields: Array<[string, string]> = [
        ['auth_date', String(now)],
        ['user', JSON.stringify(userObj)],
      ];
      fields.sort(([a], [b]) => a.localeCompare(b));
      const dataCheckString = fields.map(([k, v]) => `${k}=${v}`).join('\n');
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest();
      const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
      const params = new URLSearchParams(fields);
      params.set('hash', hash);

      const result = validator.validate(params.toString());
      expect(result.telegramUser.username).toBeUndefined();
      expect(result.telegramUser.first_name).toBe('Anonymous');
    });
  });

  // ──────────────────────────────────────────────────────────
  // ОШИБКИ ПОДПИСИ
  // ──────────────────────────────────────────────────────────

  describe('Неверная подпись', () => {
    it('неверный hash → UnauthorizedException', () => {
      const initData = generateValidInitData();
      // Портим hash
      const tampered = initData.replace(/hash=[^&]+/, 'hash=deadbeef00000000');

      expect(() => validator.validate(tampered)).toThrow(UnauthorizedException);
    });

    it('изменение user payload → неверный hash → UnauthorizedException', () => {
      const initData = generateValidInitData({ userId: 123 });
      // Подменяем user в строке (не пересчитывая hash)
      const tampered = initData.replace(
        /user=%7B[^&]+/,
        'user=' + encodeURIComponent(JSON.stringify({ id: 999, first_name: 'Hacker' })),
      );

      expect(() => validator.validate(tampered)).toThrow(UnauthorizedException);
    });

    it('отсутствие hash → UnauthorizedException', () => {
      const initData = 'auth_date=1234567890&user=%7B%22id%22%3A1%7D';

      expect(() => validator.validate(initData)).toThrow(UnauthorizedException);
    });
  });

  // ──────────────────────────────────────────────────────────
  // ПРОСРОЧЕННЫЙ auth_date
  // ──────────────────────────────────────────────────────────

  describe('Просроченный auth_date', () => {
    it('auth_date > 24ч назад → UnauthorizedException', () => {
      const oldDate = Math.floor(Date.now() / 1000) - 86_401; // 24ч + 1с
      const initData = generateValidInitData({ auth_date: oldDate });

      expect(() => validator.validate(initData)).toThrow(UnauthorizedException);
    });

    it('auth_date ровно 24ч → ещё ОК (граничный случай)', () => {
      const borderDate = Math.floor(Date.now() / 1000) - 86_400 + 1; // на 1с раньше границы
      const initData = generateValidInitData({ auth_date: borderDate });

      // Не должен бросить
      expect(() => validator.validate(initData)).not.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────
  // НЕВАЛИДНЫЙ ФОРМАТ
  // ──────────────────────────────────────────────────────────

  describe('Невалидный формат initData', () => {
    it('пустая строка → UnauthorizedException', () => {
      expect(() => validator.validate('')).toThrow(UnauthorizedException);
    });

    it('отсутствие поля user → UnauthorizedException', () => {
      // Создаём initData без user поля (только auth_date + hash)
      const now = Math.floor(Date.now() / 1000);
      const fields: Array<[string, string]> = [['auth_date', String(now)]];
      const dataCheckString = `auth_date=${now}`;
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest();
      const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      const params = new URLSearchParams(fields);
      params.set('hash', hash);

      expect(() => validator.validate(params.toString())).toThrow(UnauthorizedException);
    });

    it('user = невалидный JSON → UnauthorizedException', () => {
      const now = Math.floor(Date.now() / 1000);
      const fields: Array<[string, string]> = [
        ['auth_date', String(now)],
        ['user', 'not_json{{{'],
      ];
      fields.sort(([a], [b]) => a.localeCompare(b));
      const dataCheckString = fields.map(([k, v]) => `${k}=${v}`).join('\n');
      const secretKey = crypto.createHmac('sha256', 'WebAppData').update(TEST_BOT_TOKEN).digest();
      const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

      const params = new URLSearchParams(fields);
      params.set('hash', hash);

      expect(() => validator.validate(params.toString())).toThrow(UnauthorizedException);
    });
  });

  // ──────────────────────────────────────────────────────────
  // ДРУГОЙ BOT TOKEN
  // ──────────────────────────────────────────────────────────

  it('данные подписаны другим bot_token → UnauthorizedException', () => {
    // Генерируем данные с другим токеном
    const anotherSecretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update('another_bot_token')
      .digest();
    const now = Math.floor(Date.now() / 1000);
    const user = JSON.stringify({ id: 1, first_name: 'X' });
    const dataCheckString = `auth_date=${now}\nuser=${user}`;
    const hash = crypto
      .createHmac('sha256', anotherSecretKey)
      .update(dataCheckString)
      .digest('hex');

    const params = new URLSearchParams([
      ['auth_date', String(now)],
      ['user', user],
    ]);
    params.set('hash', hash);

    // Наш validator использует TEST_BOT_TOKEN → подпись не совпадёт
    expect(() => validator.validate(params.toString())).toThrow(UnauthorizedException);
  });
});
