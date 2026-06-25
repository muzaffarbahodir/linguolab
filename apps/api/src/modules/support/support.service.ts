import { Injectable, NotFoundException } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** POST /support/tickets — студент создаёт тикет */
  async create(studentId: string, subject: string, message: string) {
    const ticket = await this.prisma.supportTicket.create({
      data: { student_id: studentId, subject, message },
      select: {
        id: true,
        subject: true,
        status: true,
        created_at: true,
        student: { select: { first_name: true, last_name: true } },
      },
    });

    const who = `${ticket.student.first_name}${ticket.student.last_name ? ' ' + ticket.student.last_name : ''}`;
    void this.notifications.notifyStaffNewRequest(
      '🎫 Новое обращение в поддержку',
      `${who} — ${subject}`,
      `ticket:${ticket.id}`,
    );

    return ticket;
  }

  /** GET /support/tickets/my — мои тикеты (студент) */
  findMy(studentId: string) {
    return this.prisma.supportTicket.findMany({
      where: { student_id: studentId },
      select: { id: true, subject: true, message: true, status: true, created_at: true },
      orderBy: { created_at: 'desc' },
    });
  }

  /** GET /support/tickets — все тикеты (менеджер). ?status=OPEN|IN_PROGRESS|CLOSED */
  findAll(status?: string) {
    return this.prisma.supportTicket.findMany({
      where: status ? { status: status as TicketStatus } : {},
      select: {
        id: true,
        subject: true,
        message: true,
        status: true,
        created_at: true,
        student: {
          select: { id: true, first_name: true, last_name: true, telegram_username: true },
        },
      },
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
    });
  }

  /** PATCH /support/tickets/:id/status — менеджер меняет статус */
  async updateStatus(id: string, status: TicketStatus) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: { status },
      select: { id: true, status: true },
    });

    // Уведомляем студента об изменении статуса
    void this.notifications.scheduleSupportTicketUpdated(
      ticket.student_id,
      ticket.subject,
      status,
      id,
    );

    return updated;
  }
}
