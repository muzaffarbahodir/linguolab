import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, InlineKeyboard } from 'grammy';
import type { Update } from 'grammy/types';
import { Role } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

/** Роли с доступом к панели администратора */
const ADMIN_ROLES: Role[] = [Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN];

/** Красивые метки ролей */
const ROLE_LABEL: Record<string, string> = {
  MANAGER: '🔷 Менеджер',
  ADMIN: '🔴 Администратор',
  SUPER_ADMIN: '⭐ Супер-администратор',
  TEACHER: '👨‍🏫 Учитель',
  STUDENT: '🎓 Студент',
  PARENT: '👪 Родитель',
};

// ─── Onboarding ──────────────────────────────────────────────────────────────

type OnboardStep = 'role';

interface OnboardState {
  step: OnboardStep;
  lang: string;
}

const ONBOARD_TTL = 86400; // 24 hours

/** Запрос роли (после выбора языка) */
const ASK_ROLE: Record<string, string> = {
  ru: '👤 Кто вы? Выберите роль:',
  uz: '👤 Siz kimsiz? Rolni tanlang:',
  en: '👤 Who are you? Choose your role:',
};
const ROLE_BTN_STUDENT: Record<string, string> = {
  ru: '🎓 Я учусь сам',
  uz: "🎓 O'zim o'qiyman",
  en: '🎓 I study myself',
};
const ROLE_BTN_PARENT: Record<string, string> = {
  ru: '👪 Я родитель',
  uz: '👪 Men ota-onaman',
  en: "👪 I'm a parent",
};
const ONBOARD_DONE: Record<string, string> = {
  ru: '✅ <b>Готово!</b> Аккаунт создан.\n\nОткрывайте приложение — выбирайте курс и записывайтесь 🚀',
  uz: '✅ <b>Tayyor!</b> Akkaunt yaratildi.\n\nIlovani oching — kurs tanlang va yoziling 🚀',
  en: '✅ <b>Done!</b> Account created.\n\nOpen the app — pick a course and enroll 🚀',
};

/** Приветствие зарегистрированного пользователя (по локали) */
const WELCOME: Record<string, (name: string) => string> = {
  ru: (n) =>
    `Привет, <b>${n}</b>! 👋\n\nЯ бот <b>LinguoLab</b> — школы иностранных языков.\n\n` +
    `• 📚 Курсы и группы\n• 📅 Запись на занятия и пробные уроки\n` +
    `• 🔔 Уведомления о расписании и оплате\n\nОткрывайте приложение 🚀`,
  uz: (n) =>
    `Salom, <b>${n}</b>! 👋\n\nMen <b>LinguoLab</b> botiman — chet tillari maktabi.\n\n` +
    `• 📚 Kurslar va guruhlar\n• 📅 Darslar va sinov darslariga yozilish\n` +
    `• 🔔 Jadval va to'lov bildirishnomalari\n\nIlovani oching 🚀`,
  en: (n) =>
    `Hi, <b>${n}</b>! 👋\n\nI'm the <b>LinguoLab</b> bot — a language school.\n\n` +
    `• 📚 Courses and groups\n• 📅 Class & trial enrollment\n` +
    `• 🔔 Schedule & payment alerts\n\nOpen the app 🚀`,
};

/** Текст /help по локали */
const HELP: Record<string, string> = {
  ru:
    `<b>Команды LinguoLab</b>\n\n` +
    `/start — запуск / перезапуск\n/app — открыть приложение\n` +
    `/courses — каталог курсов\n/mystatus — мой статус и роль\n` +
    `/support — поддержка\n/help — это сообщение\n\n` +
    `💡 Синяя кнопка «LinguoLab» слева от поля ввода тоже открывает приложение.`,
  uz:
    `<b>LinguoLab buyruqlari</b>\n\n` +
    `/start — ishga tushirish\n/app — ilovani ochish\n` +
    `/courses — kurslar katalogi\n/mystatus — holatim va rolim\n` +
    `/support — qo'llab-quvvatlash\n/help — shu xabar\n\n` +
    `💡 Kiritish maydoni yonidagi «LinguoLab» tugmasi ham ilovani ochadi.`,
  en:
    `<b>LinguoLab commands</b>\n\n` +
    `/start — launch / restart\n/app — open the app\n` +
    `/courses — course catalog\n/mystatus — my status and role\n` +
    `/support — support\n/help — this message\n\n` +
    `💡 The blue "LinguoLab" button next to the input also opens the app.`,
};

/** Текст /support по локали */
const SUPPORT: Record<string, string> = {
  ru: `🆘 <b>Поддержка LinguoLab</b>\n\nОткройте раздел «Поддержка» в приложении — менеджер ответит там. Или напишите свой вопрос в приложении.`,
  uz: `🆘 <b>LinguoLab qo'llab-quvvatlash</b>\n\nIlovadagi «Qo'llab-quvvatlash» bo'limini oching — menejer javob beradi.`,
  en: `🆘 <b>LinguoLab support</b>\n\nOpen the "Support" section in the app — a manager will reply there.`,
};

/** Подпись кнопки «открыть приложение» по локали */
const OPEN_APP_BTN: Record<string, string> = {
  ru: 'Открыть LinguoLab 📱',
  uz: 'LinguoLab ochish 📱',
  en: 'Open LinguoLab 📱',
};

function pick(map: Record<string, string>, lang: string): string {
  return map[['ru', 'uz', 'en'].includes(lang) ? lang : 'ru'] ?? map.ru ?? '';
}

/**
 * TelegramService — grammY бот в webhook-режиме.
 *
 * Не вызывает bot.start() — обновления приходят через POST /telegram/webhook.
 * Публикует два интерфейса:
 *   handleUpdate(update)           — вызывается из TelegramController
 *   notifyEnrolled(userId, ...)    — вызывается из ClassesService после записи
 *
 * Если TELEGRAM_BOT_TOKEN не задан — бот не инициализируется,
 * методы становятся no-op (безопасно в dev без токена).
 *
 * Онбординг новых пользователей:
 *   /start → (если нет в БД) → выбор языка → выбор роли → создание аккаунта (is_active=true)
 *   → кнопка «Открыть приложение». Профиль/курсы заполняются в Mini App.
 *   Состояние шага хранится в Redis: onboard:{tgId} TTL=24ч
 */
@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Bot | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token || token === 'CHANGE_ME') {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set — bot disabled');
      return;
    }

    this.bot = new Bot(token);
    this.registerHandlers();

    // ВАЖНО: в webhook-режиме без bot.init() метод handleUpdate() бросает
    // "Bot not initialized" → ни один хендлер не срабатывает. Инициализируем
    // (getMe) до первого апдейта.
    try {
      await this.bot.init();
      this.logger.log(`Telegram bot initialized: @${this.bot.botInfo.username}`);
    } catch (err) {
      this.logger.error(`bot.init() failed — bot disabled: ${String(err)}`);
      this.bot = null;
      return;
    }

    await this.configureBotProfile(); // меню команд + кнопка-меню + вебхук
  }

  /** URL Telegram Mini App */
  private get twaUrl(): string {
    return (
      this.config.get<string>('TELEGRAM_WEB_APP_URL') ?? 'https://app-linguolab.muzaffarbahodir.uz'
    );
  }

  /**
   * Регистрирует меню команд (список по «/») и кнопку-меню чата (синяя кнопка
   * слева от поля ввода → открывает приложение). Вызывается один раз при старте.
   */
  private async configureBotProfile(): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.api.setMyCommands([
        { command: 'start', description: '🚀 Запуск / Перезапуск' },
        { command: 'app', description: '📱 Открыть приложение' },
        { command: 'courses', description: '📚 Курсы' },
        { command: 'mystatus', description: '👤 Мой статус' },
        { command: 'support', description: '🆘 Поддержка' },
        { command: 'help', description: '❓ Помощь' },
      ]);
      await this.bot.api.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: 'LinguoLab',
          web_app: { url: this.twaUrl },
        },
      });
      this.logger.log('Bot commands + menu button configured');
    } catch (err) {
      this.logger.warn(`configureBotProfile failed: ${String(err)}`);
    }

    // Авто-регистрация вебхука (иначе Telegram не доставляет апдейты → хендлеры молчат).
    const apiUrl = this.config.get<string>('API_PUBLIC_URL');
    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    if (!apiUrl || !secret) {
      this.logger.warn(
        'API_PUBLIC_URL / TELEGRAM_WEBHOOK_SECRET not set — webhook NOT registered, handlers will not fire',
      );
      return;
    }
    try {
      const url = `${apiUrl.replace(/\/$/, '')}/api/v1/telegram/webhook`;
      await this.bot!.api.setWebhook(url, {
        secret_token: secret,
        allowed_updates: ['message', 'callback_query', 'my_chat_member'],
      });
      this.logger.log(`Webhook registered: ${url}`);
    } catch (err) {
      this.logger.error(`setWebhook failed: ${String(err)}`);
    }
  }

  // ─── Redis onboarding helpers ────────────────────────────────────────────────

  private obKey(tgId: number) {
    return `onboard:${tgId}`;
  }

  private async getState(tgId: number): Promise<OnboardState | null> {
    const raw = await this.redis.get(this.obKey(tgId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OnboardState;
    } catch {
      return null;
    }
  }

  private async setState(tgId: number, state: OnboardState): Promise<void> {
    await this.redis.set(this.obKey(tgId), JSON.stringify(state), 'EX', ONBOARD_TTL);
  }

  private async clearState(tgId: number): Promise<void> {
    await this.redis.del(this.obKey(tgId));
  }

  /** Локаль пользователя по tgId (для ответов команд). По умолчанию ru. */
  private async userLocale(tgId?: number): Promise<string> {
    if (!tgId) return 'ru';
    try {
      const u = await this.prisma.user.findUnique({
        where: { telegram_user_id: BigInt(tgId) },
        select: { locale: true },
      });
      return u?.locale ?? 'ru';
    } catch {
      return 'ru';
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  private registerHandlers() {
    if (!this.bot) return;

    const twaUrl = this.twaUrl;

    // ── Глобальный перехват ошибок (один упавший хендлер не валит вебхук) ──────
    this.bot.catch((err) => {
      this.logger.error(`Bot handler error: ${String(err.error)}`);
    });

    // ── /start ────────────────────────────────────────────────────────────────

    this.bot.command('start', async (ctx) => {
      const tgId = ctx.from?.id;
      if (!tgId) return;

      const firstName = ctx.from?.first_name ?? '';

      // Смотрим в БД
      const dbUser = await this.prisma.user.findUnique({
        where: { telegram_user_id: BigInt(tgId) },
        select: { role: true, first_name: true, is_active: true, locale: true },
      });

      if (dbUser) {
        // Уже зарегистрирован
        const role = dbUser.role;
        const isAdmin = ADMIN_ROLES.includes(role);

        if (isAdmin) {
          const roleLabel = ROLE_LABEL[role] ?? role;
          const keyboard = new InlineKeyboard()
            .webApp('⚡ Панель управления', twaUrl)
            .row()
            .webApp('📱 Открыть приложение', twaUrl);

          await ctx.reply(
            `👋 Привет, <b>${dbUser.first_name ?? firstName}</b>!\n\n` +
              `${roleLabel} — у вас расширенный доступ к системе LinguoLab.\n\n` +
              `<b>Быстрые действия:</b>\n` +
              `• 👥 Управление пользователями\n` +
              `• 📊 Статистика и аналитика\n` +
              `• 📢 Рассылка студентам\n` +
              `• 📋 Журнал аудита\n\n` +
              `Откройте панель управления в приложении:`,
            { parse_mode: 'HTML', reply_markup: keyboard },
          );
        } else {
          const lang = dbUser.locale ?? 'ru';
          const welcome = (WELCOME[['ru', 'uz', 'en'].includes(lang) ? lang : 'ru'] ?? WELCOME.ru)!;
          await ctx.reply(welcome(dbUser.first_name ?? firstName), {
            parse_mode: 'HTML',
            reply_markup: new InlineKeyboard().webApp(pick(OPEN_APP_BTN, lang), twaUrl),
          });
        }
        return;
      }

      // Новый пользователь — начинаем онбординг
      await this.clearState(tgId); // сбросить старое если было

      await ctx.reply(
        `🌐 Добро пожаловать в <b>LinguoLab</b>!\n\nВыберите язык / Tilni tanlang / Choose language:`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard()
            .text('🇷🇺 Русский', 'lang:ru')
            .text("🇺🇿 O'zbek", 'lang:uz')
            .text('🇬🇧 English', 'lang:en'),
        },
      );
    });

    // ── Callback: выбор языка → выбор роли ────────────────────────────────────

    this.bot.callbackQuery(/^lang:(ru|uz|en)$/, async (ctx) => {
      const tgId = ctx.from?.id;
      if (!tgId) return;
      await ctx.answerCallbackQuery();

      const lang = ctx.match[1] ?? 'ru';
      await this.setState(tgId, { step: 'role', lang });

      await ctx.editMessageText(`🌐 <b>${lang.toUpperCase()}</b>`, { parse_mode: 'HTML' });
      await ctx.reply(pick(ASK_ROLE, lang), {
        parse_mode: 'HTML',
        reply_markup: this.roleKeyboard(lang),
      });
    });

    // ── Callback: выбор роли → создание аккаунта (авто-активный) ──────────────

    this.bot.callbackQuery(/^role:(STUDENT|PARENT)$/, async (ctx) => {
      const tgId = ctx.from?.id;
      if (!tgId) return;
      await ctx.answerCallbackQuery();

      const state = await this.getState(tgId);
      const lang = state?.lang ?? (await this.userLocale(tgId));
      const role = ctx.match[1] === 'PARENT' ? Role.PARENT : Role.STUDENT;

      try {
        await this.prisma.user.create({
          data: {
            telegram_user_id: BigInt(tgId),
            telegram_username: ctx.from?.username ?? null,
            first_name: ctx.from?.first_name ?? 'Пользователь',
            last_name: ctx.from?.last_name ?? null,
            locale: lang,
            role,
            is_active: true,
          },
        });
      } catch (err: unknown) {
        // Уже существует (повторное нажатие/гонка) — не критично.
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('Unique constraint')) {
          this.logger.error(`Onboarding create failed: ${msg}`);
        }
      }

      await this.clearState(tgId);
      await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() });
      await ctx.reply(pick(ONBOARD_DONE, lang), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().webApp(pick(OPEN_APP_BTN, lang), twaUrl),
      });
    });

    // ── /admin — быстрая сводка для администраторов ────────────────────────

    this.bot.command('admin', async (ctx) => {
      const tgId = ctx.from?.id;
      if (!tgId) return;

      const dbUser = await this.prisma.user.findUnique({
        where: { telegram_user_id: BigInt(tgId) },
        select: { role: true, first_name: true },
      });

      if (!dbUser || !ADMIN_ROLES.includes(dbUser.role)) {
        await ctx.reply('❌ Команда доступна только администраторам.');
        return;
      }

      const [totalStudents, pendingUsers, totalTeachers] = await Promise.all([
        this.prisma.user.count({ where: { role: Role.STUDENT } }),
        this.prisma.user.count({ where: { is_active: false } }),
        this.prisma.user.count({ where: { role: Role.TEACHER } }),
      ]);

      const roleLabel = ROLE_LABEL[dbUser.role] ?? dbUser.role;
      const keyboard = new InlineKeyboard().webApp('🔐 Открыть панель', twaUrl);

      await ctx.reply(
        `🔐 <b>Панель администратора LinguoLab</b>\n` +
          `${roleLabel}\n\n` +
          `<b>Статистика:</b>\n` +
          `• 🎓 Студентов: <b>${totalStudents}</b>\n` +
          `• 👨‍🏫 Учителей: <b>${totalTeachers}</b>\n` +
          `• ⏳ Ожидают активации: <b>${pendingUsers}</b>\n\n` +
          `Для полного управления откройте панель:`,
        { parse_mode: 'HTML', reply_markup: keyboard },
      );
    });

    // ── /mystatus — показать свою роль ────────────────────────────────────

    this.bot.command('mystatus', async (ctx) => {
      const tgId = ctx.from?.id;
      if (!tgId) return;

      const dbUser = await this.prisma.user.findUnique({
        where: { telegram_user_id: BigInt(tgId) },
        select: { role: true, first_name: true, is_active: true, created_at: true },
      });

      if (!dbUser) {
        await ctx.reply(
          '❓ Вы ещё не зарегистрированы в системе.\n\nОтправьте /start чтобы пройти регистрацию.',
        );
        return;
      }

      const roleLabel = ROLE_LABEL[dbUser.role] ?? dbUser.role;
      const statusLabel = dbUser.is_active ? '✅ Активен' : '⏳ Ожидает активации';
      const since = new Date(dbUser.created_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      await ctx.reply(
        `👤 <b>Ваш статус в LinguoLab</b>\n\n` +
          `Имя: <b>${dbUser.first_name}</b>\n` +
          `Роль: <b>${roleLabel}</b>\n` +
          `Статус: <b>${statusLabel}</b>\n` +
          `В системе с: <b>${since}</b>`,
        { parse_mode: 'HTML' },
      );
    });

    // ── /app — открыть приложение ──────────────────────────────────────────
    this.bot.command('app', async (ctx) => {
      const lang = await this.userLocale(ctx.from?.id);
      await ctx.reply('👇', {
        reply_markup: new InlineKeyboard().webApp(pick(OPEN_APP_BTN, lang), twaUrl),
      });
    });

    // ── /courses — каталог курсов ──────────────────────────────────────────
    this.bot.command('courses', async (ctx) => {
      const lang = await this.userLocale(ctx.from?.id);
      const text =
        lang === 'uz'
          ? '📚 Kurslar katalogi ilovada — oching va tanlang:'
          : lang === 'en'
            ? '📚 The course catalog is in the app — open and browse:'
            : '📚 Каталог курсов в приложении — открывайте и выбирайте:';
      await ctx.reply(text, {
        reply_markup: new InlineKeyboard().webApp(pick(OPEN_APP_BTN, lang), twaUrl),
      });
    });

    // ── /help — список команд ──────────────────────────────────────────────
    this.bot.command('help', async (ctx) => {
      const lang = await this.userLocale(ctx.from?.id);
      await ctx.reply(pick(HELP, lang), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().webApp(pick(OPEN_APP_BTN, lang), twaUrl),
      });
    });

    // ── /support — поддержка ───────────────────────────────────────────────
    this.bot.command('support', async (ctx) => {
      const lang = await this.userLocale(ctx.from?.id);
      await ctx.reply(pick(SUPPORT, lang), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().webApp(pick(OPEN_APP_BTN, lang), twaUrl),
      });
    });

    // ── Сообщение: текст (ПОСЛЕ всех команд — иначе перехватит /help и др.) ──

    this.bot.on('message:text', async (ctx) => {
      const tgId = ctx.from?.id;
      if (!tgId) return;

      // Неизвестная команда (все известные перехвачены bot.command выше).
      if (ctx.message.text.startsWith('/')) {
        const lang = await this.userLocale(tgId);
        const txt =
          lang === 'uz'
            ? "🤔 Noma'lum buyruq. /help — buyruqlar ro'yxati."
            : lang === 'en'
              ? '🤔 Unknown command. /help — list of commands.'
              : '🤔 Неизвестная команда. /help — список команд.';
        await ctx.reply(txt);
        return;
      }

      const state = await this.getState(tgId);

      // Ждём выбор роли кнопкой — повторяем подсказку.
      if (state?.step === 'role') {
        await ctx.reply(pick(ASK_ROLE, state.lang), {
          parse_mode: 'HTML',
          reply_markup: this.roleKeyboard(state.lang),
        });
        return;
      }

      // Вне онбординга → открыть приложение.
      const lang = await this.userLocale(tgId);
      await ctx.reply('LinguoLab 📱', {
        reply_markup: new InlineKeyboard().webApp(pick(OPEN_APP_BTN, lang), twaUrl),
      });
    });

    // ── Автоматическое обновление tg_blocked ─────────────────────────────

    this.bot.on('my_chat_member', async (ctx) => {
      const tgId = ctx.myChatMember?.from?.id;
      if (!tgId) return;

      const newStatus = ctx.myChatMember?.new_chat_member?.status;
      const blocked = newStatus === 'kicked' || newStatus === 'left';
      const unblocked = newStatus === 'member';

      if (!blocked && !unblocked) return;

      try {
        await this.prisma.user.updateMany({
          where: { telegram_user_id: BigInt(tgId) },
          data: { tg_blocked: blocked },
        });
        this.logger.log(`tg_blocked=${blocked} for tgId=${tgId} (status=${newStatus})`);
      } catch (err) {
        this.logger.error(`Failed to update tg_blocked for ${tgId}: ${String(err)}`);
      }
    });
  }

  /** Клавиатура выбора роли (студент / родитель) по локали. */
  private roleKeyboard(lang: string): InlineKeyboard {
    return new InlineKeyboard()
      .text(pick(ROLE_BTN_STUDENT, lang), 'role:STUDENT')
      .row()
      .text(pick(ROLE_BTN_PARENT, lang), 'role:PARENT');
  }

  // ─── Webhook handler ───────────────────────────────────────────────────────

  /** Вызывается контроллером при входящем webhook update */
  async handleUpdate(update: Update): Promise<void> {
    if (!this.bot) return;
    await this.bot.handleUpdate(update);
  }

  /**
   * Реальный статус бота + вебхука из Telegram (для диагностики).
   * last_error_message обычно прямо говорит причину (401, connection refused, и т.д.).
   */
  async getLiveStatus(): Promise<Record<string, unknown>> {
    if (!this.bot) {
      return { enabled: false, reason: 'TELEGRAM_BOT_TOKEN not set or bot.init() failed' };
    }
    try {
      const info = await this.bot.api.getWebhookInfo();
      return {
        enabled: true,
        bot_username: this.bot.botInfo?.username ?? null,
        webhook: {
          url: info.url || '(empty — webhook NOT set)',
          pending_update_count: info.pending_update_count,
          ip_address: info.ip_address ?? null,
          last_error_date: info.last_error_date
            ? new Date(info.last_error_date * 1000).toISOString()
            : null,
          last_error_message: info.last_error_message ?? null,
          allowed_updates: info.allowed_updates ?? null,
        },
      };
    } catch (err) {
      return { enabled: true, error: String(err) };
    }
  }

  // ─── Notifications ─────────────────────────────────────────────────────────

  async notifyEnrolled(
    telegramUserId: bigint,
    classTitle: string,
    teacherName: string,
    languageEmoji: string,
  ): Promise<void> {
    if (!this.bot) return;

    try {
      await this.bot.api.sendMessage(
        telegramUserId.toString(),
        `${languageEmoji} <b>Заявка принята!</b>\n\n` +
          `Вы записались в группу:\n<b>${classTitle}</b>\n` +
          `Преподаватель: ${teacherName}\n\n` +
          `⏳ Статус: <i>Ожидает подтверждения</i>\n` +
          `Менеджер свяжется с вами в ближайшее время для подтверждения и оплаты.`,
        { parse_mode: 'HTML' },
      );
    } catch (err) {
      this.logger.warn(`Failed to notify user ${telegramUserId}: ${String(err)}`);
    }
  }

  async sendGroupInvite(telegramUserId: bigint, chatId: bigint, classTitle: string): Promise<void> {
    if (!this.bot) return;

    try {
      const invite = await this.bot.api.createChatInviteLink(Number(chatId), {
        member_limit: 1,
        name: classTitle,
      });

      await this.bot.api.sendMessage(
        telegramUserId.toString(),
        `🎉 <b>Заявка одобрена!</b>\n\n` +
          `Вы зачислены в группу: <b>${classTitle}</b>\n\n` +
          `Нажмите кнопку ниже чтобы вступить в Telegram-группу класса:`,
        {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().url('Вступить в группу 👥', invite.invite_link),
        },
      );
    } catch (err) {
      this.logger.warn(`Failed to send group invite to ${telegramUserId}: ${String(err)}`);
    }
  }

  async sendMessage(telegramUserId: number, html: string): Promise<void> {
    return this.sendMessageStr(telegramUserId.toString(), html);
  }

  async sendMessageStr(telegramUserId: string, html: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.api.sendMessage(telegramUserId, html, { parse_mode: 'HTML' });
    } catch (err) {
      this.logger.warn(`sendMessage to ${telegramUserId} failed: ${String(err)}`);
    }
  }

  getWebhookInfo() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const apiUrl = this.config.get<string>('API_PUBLIC_URL');
    const secret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET');
    return {
      setWebhookUrl: `https://api.telegram.org/bot${token}/setWebhook`,
      webhookUrl: `${apiUrl}/api/v1/telegram/webhook`,
      secretToken: secret,
    };
  }
}
