import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CEFR, ClassStatus, Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { AdminService } from './admin.service';
import { AuditService } from '../audit/audit.service';

@Controller('admin')
@Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  /** GET /admin/dashboard/widgets */
  @Get('dashboard/widgets')
  dashboardWidgets() {
    return this.adminService.dashboardWidgets();
  }

  // ─── Students ───────────────────────────────────────────────────────────────

  /** GET /admin/students?page=1&limit=20&search=xxx */
  @Get('students')
  listStudents(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.listStudents(page, limit, search);
  }

  /**
   * GET /admin/students/export
   * Возвращает CSV-файл со всеми студентами.
   * ВАЖНО: этот маршрут должен быть ВЫШЕ /:id, иначе 'export' будет захвачен как param.
   */
  @Get('students/export')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async exportStudents(@Res() res: Response) {
    const csv = await this.adminService.exportStudentsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
    res.send('﻿' + csv); // BOM для корректного открытия в Excel
  }

  /** GET /admin/students/:id */
  @Get('students/:id')
  getStudent(@Param('id') id: string) {
    return this.adminService.getStudent(id);
  }

  /** PATCH /admin/students/:id */
  @Patch('students/:id')
  updateStudent(
    @Param('id') id: string,
    @Body() dto: { first_name?: string; last_name?: string; phone?: string; locale?: string },
  ) {
    return this.adminService.updateStudent(id, dto);
  }

  /** DELETE /admin/students/:id — ADMIN+ only */
  @Delete('students/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  deleteStudent(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.adminService.deleteStudent(id, user.id);
  }

  // ─── Teachers ───────────────────────────────────────────────────────────────

  /** GET /admin/teachers */
  @Get('teachers')
  listTeachers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.listTeachers(page, limit);
  }

  /** POST /admin/teachers */
  @Post('teachers')
  createTeacher(
    @CurrentUser() user: RequestUser,
    @Body()
    dto: {
      first_name: string;
      last_name?: string;
      email: string;
      phone?: string;
      bio?: string;
    },
  ) {
    return this.adminService.createTeacher(dto, user.id);
  }

  /** PATCH /admin/teachers/:id */
  @Patch('teachers/:id')
  updateTeacher(
    @Param('id') id: string,
    @Body() dto: { bio?: string; photo_url?: string; first_name?: string; last_name?: string },
  ) {
    return this.adminService.updateTeacher(id, dto);
  }

  /** DELETE /admin/teachers/:id — ADMIN+ only */
  @Delete('teachers/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  deleteTeacher(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.adminService.deleteTeacher(id, user.id);
  }

  // ─── Classes ────────────────────────────────────────────────────────────────

  /** GET /admin/classes */
  @Get('classes')
  listClasses(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.adminService.listClasses(page, limit);
  }

  /** POST /admin/classes */
  @Post('classes')
  createClass(
    @CurrentUser() user: RequestUser,
    @Body()
    dto: {
      language_id: string;
      teacher_id: string;
      title: string;
      level: CEFR;
      price_uzs: number;
      price_usd?: number;
      max_students?: number;
      description?: string;
    },
  ) {
    return this.adminService.createClass(dto, user.id);
  }

  /** PATCH /admin/classes/:id */
  @Patch('classes/:id')
  updateClass(
    @Param('id') id: string,
    @Body()
    dto: {
      title?: string;
      level?: CEFR;
      price_uzs?: number;
      price_usd?: number;
      max_students?: number;
      description?: string;
      is_active?: boolean;
    },
  ) {
    return this.adminService.updateClass(id, dto);
  }

  /** PATCH /admin/classes/:id/status — ручная смена статуса класса */
  @Patch('classes/:id/status')
  updateClassStatus(@Param('id') id: string, @Body('status') status: ClassStatus) {
    return this.adminService.updateClassStatus(id, status);
  }

  /** DELETE /admin/classes/:id — ADMIN+ only */
  @Delete('classes/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  deleteClass(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.adminService.deleteClass(id, user.id);
  }

  // ─── Users / Roles ──────────────────────────────────────────────────────────

  /**
   * GET /admin/users?page=1&limit=20&role=STUDENT — MANAGER+.
   * Менеджеру не показываем ADMIN/SUPER_ADMIN аккаунты.
   */
  @Get('users')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  listUsers(
    @CurrentUser() user: RequestUser,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: Role,
  ) {
    return this.adminService.listUsers(page, limit, role, user.role);
  }

  /** GET /admin/users/:id — полная карточка пользователя. MANAGER+. */
  @Get('users/:id')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  getUser(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.adminService.getUser(id, user.role);
  }

  /** PATCH /admin/users/:id/role — ADMIN+ */
  @Patch('users/:id/role')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  changeRole(
    @CurrentUser() requester: RequestUser,
    @Param('id') targetId: string,
    @Body('role') role: Role,
  ) {
    return this.adminService.changeRole(targetId, role, requester.id, requester.role);
  }

  // ─── Broadcast TG ───────────────────────────────────────────────────────────

  /**
   * POST /admin/notifications/broadcast
   * Body: { message: string, target: 'all' | classId }
   * ADMIN+ чтобы не допустить случайную массовую рассылку от менеджера.
   */
  @Post('notifications/broadcast')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  broadcast(
    @CurrentUser() user: RequestUser,
    @Body() dto: { message: string; target: 'all' | string },
  ) {
    return this.adminService.broadcast(dto, user.id);
  }

  // ─── Export CSV ──────────────────────────────────────────────────────────────

  /**
   * GET /admin/payments/export
   * Возвращает CSV-файл с платежами.
   */
  @Get('payments/export')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async exportPayments(@Res() res: Response) {
    const csv = await this.adminService.exportPaymentsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
    res.send('﻿' + csv); // BOM для корректного открытия в Excel
  }

  // ─── Audit Log ───────────────────────────────────────────────────────────────

  /**
   * GET /admin/audit?page=1&limit=50&action=role_changed&entityType=user
   * ADMIN+ — только для администраторов.
   */
  @Get('audit')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  listAudit(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.auditService.list({ page, limit, actorId, action, entityType });
  }

  // ─── Settings (PaymentProviderConfig) ────────────────────────────────────────

  /** GET /admin/settings/payment-providers */
  @Get('settings/payment-providers')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  listPaymentProviders() {
    return this.adminService.listPaymentProviders();
  }

  /** PATCH /admin/settings/payment-providers/:provider */
  @Patch('settings/payment-providers/:provider')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  updatePaymentProvider(
    @CurrentUser() user: RequestUser,
    @Param('provider') provider: string,
    @Body() dto: { is_enabled?: boolean; display_order?: number; config?: Record<string, unknown> },
  ) {
    return this.adminService.updatePaymentProvider(provider, dto, user.id);
  }

  // ─── Analytics ───────────────────────────────────────────────────────────────

  /**
   * GET /admin/analytics/revenue?months=12
   * Выручка по месяцам (только PAID). ADMIN+.
   */
  @Get('analytics/revenue')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  analyticsRevenue(@Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number) {
    return this.adminService.analyticsRevenue(months);
  }

  /**
   * GET /admin/analytics/students?months=12
   * Новые студенты по месяцам. ADMIN+.
   */
  @Get('analytics/students')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  analyticsStudents(@Query('months', new DefaultValuePipe(12), ParseIntPipe) months: number) {
    return this.adminService.analyticsStudents(months);
  }

  /**
   * GET /admin/analytics/enrollments
   * Воронка записей + помесячная разбивка. ADMIN+.
   */
  @Get('analytics/enrollments')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  analyticsEnrollments() {
    return this.adminService.analyticsEnrollments();
  }
}
