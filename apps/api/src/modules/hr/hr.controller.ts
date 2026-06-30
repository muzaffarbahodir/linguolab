import { Controller, Get, Post, Patch, Delete, Body, Param, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';

import { Roles } from '../auth/decorators/roles.decorator';
import { HrService, type UpsertEmployeeDto } from './hr.service';

/** HR / зарплата — только ADMIN / SUPER_ADMIN (чувствительные данные). */
@Controller('hr')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class HrController {
  constructor(private readonly hr: HrService) {}

  // ─── Employees ───────────────────────────────────────────────────────────────

  @Get('employees')
  listEmployees() {
    return this.hr.listEmployees();
  }

  @Post('employees')
  createEmployee(@Body() dto: UpsertEmployeeDto) {
    return this.hr.createEmployee(dto);
  }

  @Patch('employees/:id')
  updateEmployee(@Param('id') id: string, @Body() dto: UpsertEmployeeDto) {
    return this.hr.updateEmployee(id, dto);
  }

  @Delete('employees/:id')
  removeEmployee(@Param('id') id: string) {
    return this.hr.removeEmployee(id);
  }

  // ─── Payroll ─────────────────────────────────────────────────────────────────

  @Get('payroll/runs')
  listRuns() {
    return this.hr.listRuns();
  }

  @Get('payroll/runs/:id')
  getRun(@Param('id') id: string) {
    return this.hr.getRun(id);
  }

  /** GET /hr/payroll/runs/:id/export — реестр зарплат CSV (для бухгалтера). */
  @Get('payroll/runs/:id/export')
  async exportPayroll(@Param('id') id: string, @Res() res: Response) {
    const { period, csv } = await this.hr.exportPayrollCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="payroll-${period}.csv"`);
    res.send('﻿' + csv); // BOM для корректного открытия в Excel
  }

  /** Сформировать черновик зарплаты за месяц. Body: { period: "YYYY-MM" } */
  @Post('payroll/runs')
  generate(@Body('period') period: string) {
    return this.hr.generateDraft(period);
  }

  @Post('payroll/runs/:id/finalize')
  finalize(@Param('id') id: string) {
    return this.hr.finalizeRun(id);
  }
}
