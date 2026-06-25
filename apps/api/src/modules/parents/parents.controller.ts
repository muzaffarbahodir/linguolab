import { Controller, Get, Post, Delete, Param, Body } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParentsService } from './parents.service';

/**
 * ParentsController — API для модуля «Родители».
 *
 * Правила доступа:
 *  - POST /parents/invite               → PARENT (создать код)
 *  - POST /parents/invite/:code/accept  → STUDENT (принять код)
 *  - GET  /parents/children             → PARENT
 *  - DELETE /parents/children/:childId  → PARENT
 *  - GET  /parents/children/:childId/*  → PARENT (read-only данные ребёнка)
 *
 * PARENT role назначается вручную через Admin API (смена роли меняет token_version).
 */
@Controller('parents')
export class ParentsController {
  constructor(private readonly parents: ParentsService) {}

  // ─── Invite ───────────────────────────────────────────────────────────────

  /**
   * POST /parents/invite
   * Создаёт invite-код (действует 24ч).
   * Предыдущие активные инвайты этого родителя аннулируются.
   */
  @Post('invite')
  @Roles(Role.PARENT)
  createInvite(@CurrentUser('id') parentId: string) {
    return this.parents.createInvite(parentId);
  }

  /**
   * POST /parents/invite/:code/accept
   * Студент вводит код → создаётся связь родитель-ребёнок.
   */
  @Post('invite/:code/accept')
  @Roles(Role.STUDENT)
  acceptInvite(@Param('code') code: string, @CurrentUser('id') childId: string) {
    return this.parents.acceptInvite(code, childId);
  }

  // ─── Children ─────────────────────────────────────────────────────────────

  /**
   * GET /parents/children
   * Список детей с активными классами.
   */
  @Get('children')
  @Roles(Role.PARENT)
  getChildren(@CurrentUser('id') parentId: string) {
    return this.parents.getChildren(parentId);
  }

  /**
   * DELETE /parents/children/:childId
   * Отвязать ребёнка от родителя.
   */
  @Delete('children/:childId')
  @Roles(Role.PARENT)
  unlinkChild(@CurrentUser('id') parentId: string, @Param('childId') childId: string) {
    return this.parents.unlinkChild(parentId, childId);
  }

  // ─── Child read-only APIs ─────────────────────────────────────────────────

  /** GET /parents/children/:childId/schedule — расписание ребёнка */
  @Get('children/:childId/schedule')
  @Roles(Role.PARENT)
  getChildSchedule(@CurrentUser('id') parentId: string, @Param('childId') childId: string) {
    return this.parents.getChildSchedule(parentId, childId);
  }

  /** GET /parents/children/:childId/homework — домашние задания ребёнка */
  @Get('children/:childId/homework')
  @Roles(Role.PARENT)
  getChildHomework(@CurrentUser('id') parentId: string, @Param('childId') childId: string) {
    return this.parents.getChildHomework(parentId, childId);
  }

  /** GET /parents/children/:childId/attendance — посещаемость ребёнка */
  @Get('children/:childId/attendance')
  @Roles(Role.PARENT)
  getChildAttendance(@CurrentUser('id') parentId: string, @Param('childId') childId: string) {
    return this.parents.getChildAttendance(parentId, childId);
  }

  /** GET /parents/children/:childId/progress — прогресс, достижения, статистика ребёнка */
  @Get('children/:childId/progress')
  @Roles(Role.PARENT)
  getChildProgress(@CurrentUser('id') parentId: string, @Param('childId') childId: string) {
    return this.parents.getChildProgress(parentId, childId);
  }

  /** GET /parents/children/:childId/overview — сводная карточка для дашборда */
  @Get('children/:childId/overview')
  @Roles(Role.PARENT)
  getChildOverview(@CurrentUser('id') parentId: string, @Param('childId') childId: string) {
    return this.parents.getChildOverview(parentId, childId);
  }
}
