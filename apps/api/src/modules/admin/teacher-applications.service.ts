import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, type TeacherApplicationStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BRING_IN_PERSON, type TeacherDocument } from '../users/teacher-documents';

/**
 * Разбор заявок в преподаватели.
 *
 * Задача — сократить работу менеджера до одного экрана: посмотреть документы,
 * назначить созвон и принять решение. Отказать можно и до созвона — если по
 * бумагам уже понятно, что не подходит, тратить на встречу время незачем.
 */
@Injectable()
export class TeacherApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Список заявок. По умолчанию — только те, что ждут решения. */
  async list(status?: TeacherApplicationStatus) {
    const rows = await this.prisma.teacherApplication.findMany({
      where: status ? { status } : { status: { in: ['PENDING', 'INTERVIEW'] } },
      orderBy: [{ status: 'asc' }, { created_at: 'asc' }],
      select: {
        id: true,
        subject: true,
        work_format: true,
        age: true,
        experience_years: true,
        certificates: true,
        about: true,
        documents: true,
        status: true,
        admin_note: true,
        interview_at: true,
        created_at: true,
        user: {
          select: { id: true, first_name: true, last_name: true, telegram_username: true },
        },
      },
    });

    return rows.map((r) => ({
      ...r,
      documents: (r.documents as unknown as TeacherDocument[] | null) ?? [],
      // Что кандидат должен привезти лично — менеджеру нужно это видеть,
      // чтобы попросить на созвоне.
      bring_in_person: BRING_IN_PERSON[r.work_format],
    }));
  }

  /**
   * Назначить созвон. Документы к этому моменту менеджер уже посмотрел —
   * встреча нужна, чтобы поговорить с человеком, а не чтобы читать бумаги.
   */
  async scheduleInterview(id: string, whenIso: string, actorId: string) {
    const app = await this.load(id);
    if (app.status !== 'PENDING') {
      throw new BadRequestException('Созвон назначается только по новой заявке');
    }

    const when = new Date(whenIso);
    if (isNaN(when.getTime())) throw new BadRequestException('Неверная дата созвона');
    if (when.getTime() < Date.now()) {
      throw new BadRequestException('Дата созвона уже прошла');
    }

    const updated = await this.prisma.teacherApplication.update({
      where: { id },
      data: { status: 'INTERVIEW', interview_at: when },
      select: { id: true, status: true, interview_at: true },
    });

    void this.audit.log(actorId, 'teacher_application_interview', 'teacher_application', id, {
      interview_at: when.toISOString(),
    });
    void this.notifications.scheduleTeacherApplicationUpdate(
      app.user_id,
      '📞 Назначен созвон',
      `По вашей заявке в преподаватели назначен созвон: <b>${when.toLocaleString('ru-RU', {
        timeZone: 'Asia/Tashkent',
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })}</b> (UTC+5). Мы свяжемся с вами в Telegram.`,
      id,
      'interview',
    );

    return updated;
  }

  /**
   * Принять кандидата: выдаём роль, заводим карточку преподавателя и
   * активируем аккаунт. Всё вместе — иначе человек получит роль, но не
   * появится в списке учителей и не сможет вести группы.
   */
  async approve(id: string, actorId: string) {
    const app = await this.load(id);
    if (app.status === 'APPROVED') return { id, status: app.status, already: true };
    if (app.status === 'REJECTED') {
      throw new BadRequestException('Заявка уже отклонена');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.teacherApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewed_at: new Date(),
          reviewed_by: actorId,
          admin_note: null,
        },
      });
      await tx.user.update({
        where: { id: app.user_id },
        // token_version — чтобы старый JWT со студенческой ролью перестал
        // действовать и приложение перечиталось уже как преподавательское.
        data: { role: Role.TEACHER, is_active: true, token_version: { increment: 1 } },
      });
      const existing = await tx.teacher.findUnique({ where: { user_id: app.user_id } });
      if (!existing) {
        await tx.teacher.create({ data: { user_id: app.user_id, bio: app.about ?? null } });
      }
    });

    void this.audit.log(actorId, 'teacher_application_approved', 'teacher_application', id, {
      user_id: app.user_id,
      subject: app.subject,
    });
    void this.notifications.scheduleTeacherApplicationUpdate(
      app.user_id,
      '🎉 Вас приняли',
      'Заявка одобрена — откройте приложение, вам доступен кабинет преподавателя.',
      id,
      'approved',
    );

    return { id, status: 'APPROVED' as const, already: false };
  }

  /** Отказ. Причина обязательна: человек должен понимать, что произошло. */
  async reject(id: string, reason: string, actorId: string) {
    const app = await this.load(id);
    if (app.status === 'APPROVED') {
      throw new BadRequestException('Заявка уже одобрена');
    }
    const note = reason?.trim();
    if (!note) throw new BadRequestException('Укажите причину отказа');

    const updated = await this.prisma.teacherApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        admin_note: note,
        reviewed_at: new Date(),
        reviewed_by: actorId,
      },
      select: { id: true, status: true },
    });

    void this.audit.log(actorId, 'teacher_application_rejected', 'teacher_application', id, {
      reason: note,
    });
    void this.notifications.scheduleTeacherApplicationUpdate(
      app.user_id,
      'Заявка в преподаватели',
      `К сожалению, сейчас мы не готовы вас принять.\n\n<i>${note}</i>`,
      id,
      'rejected',
    );

    return updated;
  }

  private async load(id: string) {
    const app = await this.prisma.teacherApplication.findUnique({
      where: { id },
      select: { id: true, user_id: true, status: true, subject: true, about: true },
    });
    if (!app) throw new NotFoundException('Заявка не найдена');
    return app;
  }
}
