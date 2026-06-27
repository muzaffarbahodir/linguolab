import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TrialType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TelegramService } from '../telegram/telegram.service';

/** Сколько дней действует бесплатный онлайн-пробный доступ */
const TRIAL_DAYS = 7;

const trialSelect = {
  id: true,
  type: true,
  status: true,
  note: true,
  class_id: true,
  created_at: true,
  language: { select: { id: true, name_ru: true, flag_emoji: true, color: true } },
} as const;

@Injectable()
export class TrialLessonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
  ) {}

  /**
   * POST /trial-lessons/request
   * Студент оставляет заявку на пробный урок.
   *  - ONLINE  — бесплатно, авто без менеджера: привязываем к открытому курсу
   *              языка → пробная запись (is_trial) → шлём Zoom-ссылку.
   *  - OFFLINE — очно, нужна оплата: создаём PENDING-заявку, фронт ведёт на оплату.
   *              После оплаты заявка авто-подтверждается (handlePaidPayment).
   * Один студент — не более одной PENDING/CONFIRMED-заявки на язык.
   */
  async request(studentId: string, languageId: string, type: TrialType, note?: string) {
    const existing = await this.prisma.trialLessonRequest.findFirst({
      where: {
        student_id: studentId,
        language_id: languageId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });
    if (existing) {
      throw new BadRequestException('Заявка на пробный урок по этому языку уже есть');
    }

    const openClass = await this.findOpenClassForLanguage(languageId);

    // ── Очный (платный) ──
    // Заявку НЕ создаём здесь — только после успешной оплаты (handlePaidPayment).
    // Это убирает «висящие» неоплаченные заявки и блокировку повторной попытки.
    if (type === TrialType.OFFLINE) {
      if (!openClass) {
        throw new BadRequestException(
          'Пока нет открытых курсов по этому языку для очного пробного',
        );
      }
      const lang = await this.prisma.language.findUnique({
        where: { id: languageId },
        select: { id: true, name_ru: true, flag_emoji: true, color: true },
      });
      if (!lang) throw new NotFoundException('Language not found');
      return {
        id: '',
        type: TrialType.OFFLINE,
        status: 'PENDING' as const,
        note: note ?? null,
        class_id: openClass.id,
        created_at: new Date(),
        language: lang,
        needs_payment: true,
        price_uzs: openClass.price_uzs,
      };
    }

    // ── Онлайн (бесплатный, авто) ──
    if (!openClass) {
      // Нет открытого курса — оставляем заявку, уведомляем персонал/учителей.
      const created = await this.prisma.trialLessonRequest.create({
        data: {
          student_id: studentId,
          language_id: languageId,
          type: TrialType.ONLINE,
          note,
          status: 'PENDING',
        },
        select: trialSelect,
      });
      this.notifyStaff(
        created.id,
        studentId,
        created.language.name_ru,
        'онлайн (нет открытого курса)',
      );
      return { ...created, needs_payment: false };
    }

    // Привязка к открытому курсу: пробная запись (если ещё не записан) + Zoom.
    const enrolled = await this.prisma.enrollment.findUnique({
      where: { student_id_class_id: { student_id: studentId, class_id: openClass.id } },
    });
    if (!enrolled) {
      await this.prisma.enrollment.create({
        data: {
          student_id: studentId,
          class_id: openClass.id,
          status: 'ACTIVE',
          is_trial: true,
          trial_expires_at: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
        },
      });
    }

    const created = await this.prisma.trialLessonRequest.create({
      data: {
        student_id: studentId,
        language_id: languageId,
        type: TrialType.ONLINE,
        class_id: openClass.id,
        note,
        status: 'CONFIRMED',
      },
      select: trialSelect,
    });

    void this.sendTrialAccess(studentId, openClass);
    void this.notifications.scheduleTrialConfirmed(studentId, created.language.name_ru, created.id);

    return { ...created, needs_payment: false };
  }

  /** GET /trial-lessons/my — мои заявки */
  findMy(studentId: string) {
    return this.prisma.trialLessonRequest.findMany({
      where: { student_id: studentId },
      select: trialSelect,
      orderBy: { created_at: 'desc' },
    });
  }

  /** GET /trial-lessons — все заявки (менеджер). ?status=PENDING|CONFIRMED|CANCELLED */
  findAll(status?: string) {
    return this.prisma.trialLessonRequest.findMany({
      where: status ? { status: status as never } : {},
      select: {
        ...trialSelect,
        student: {
          select: { id: true, first_name: true, last_name: true, telegram_username: true },
        },
      },
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    });
  }

  /** PATCH /trial-lessons/:id/status — менеджер подтверждает или отменяет */
  async updateStatus(id: string, status: 'CONFIRMED' | 'CANCELLED') {
    const req = await this.prisma.trialLessonRequest.findUnique({
      where: { id },
      include: { language: { select: { name_ru: true } } },
    });
    if (!req) throw new NotFoundException('Trial request not found');

    const updated = await this.prisma.trialLessonRequest.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });

    const langName = req.language?.name_ru ?? 'выбранному языку';
    if (status === 'CONFIRMED') {
      void this.notifications.scheduleTrialConfirmed(req.student_id, langName, id);
    } else {
      void this.notifications.scheduleTrialCancelled(req.student_id, langName, id);
    }

    return updated;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  /** Открытый курс языка, куда можно привязать пробного студента. */
  private findOpenClassForLanguage(languageId: string) {
    return this.prisma.class.findFirst({
      where: {
        language_id: languageId,
        is_active: true,
        status: { in: ['ENROLLMENT_OPEN', 'ACTIVE'] },
      },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        title: true,
        price_uzs: true,
        telegram_chat_id: true,
        meeting_url: true,
      },
    });
  }

  /** Отправляет студенту инвайт в группу + Zoom-ссылку пробного курса. */
  private async sendTrialAccess(
    studentId: string,
    cls: { id: string; title: string; telegram_chat_id: bigint | null; meeting_url: string | null },
  ): Promise<void> {
    try {
      const student = await this.prisma.user.findUnique({
        where: { id: studentId },
        select: { telegram_user_id: true },
      });
      if (!student) return;

      if (cls.telegram_chat_id) {
        await this.telegram.sendGroupInvite(
          student.telegram_user_id,
          cls.telegram_chat_id,
          cls.title,
        );
      }
      if (cls.meeting_url) {
        await this.telegram.sendMessageStr(
          student.telegram_user_id.toString(),
          `🎓 <b>Пробный урок: ${cls.title}</b>\n\nСсылка на онлайн-урок:\n${cls.meeting_url}`,
        );
      }
    } catch {
      // не ломаем основной флоу
    }
  }

  private notifyStaff(trialId: string, studentId: string, langName: string, kind: string) {
    void (async () => {
      const stu = await this.prisma.user.findUnique({
        where: { id: studentId },
        select: { first_name: true, last_name: true },
      });
      const who = stu ? `${stu.first_name}${stu.last_name ? ' ' + stu.last_name : ''}` : 'Студент';
      await this.notifications.notifyStaffNewRequest(
        '🎯 Новая заявка на пробный урок',
        `${who} — ${langName} · ${kind}`,
        `trial:${trialId}`,
      );
    })();
  }
}
