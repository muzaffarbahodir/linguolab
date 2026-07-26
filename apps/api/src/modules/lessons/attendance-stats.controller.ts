import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { AttendanceStatsService } from './attendance-stats.service';
import { DropoutRiskService } from './dropout-risk.service';

/**
 * Посещаемость и риск оттока — рабочие цифры менеджера.
 *
 * Отдельный контроллер, а не ветка /lessons: это отчётность по школе, доступ к
 * ней только у персонала, тогда как /lessons открыт студентам и учителям.
 */
@Controller('attendance')
@Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
export class AttendanceStatsController {
  constructor(
    private readonly stats: AttendanceStatsService,
    private readonly dropout: DropoutRiskService,
  ) {}

  /** Период по умолчанию — 30 дней: примерно учебный месяц. */
  private range(days: number): { since: Date; until: Date } {
    const until = new Date();
    return { since: new Date(until.getTime() - days * 86_400_000), until };
  }

  /** GET /attendance/overview?days=30 — сводка по школе. */
  @Get('overview')
  overview(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    const { since, until } = this.range(days);
    return this.stats.overview(since, until);
  }

  /** GET /attendance/by-class?days=30 — худшие группы сверху. */
  @Get('by-class')
  byClass(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    const { since, until } = this.range(days);
    return this.stats.byClass(since, until);
  }

  /** GET /attendance/by-student?days=30&limit=50 — кого пора возвращать. */
  @Get('by-student')
  byStudent(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const { since, until } = this.range(days);
    return this.stats.byStudent(since, until, limit);
  }

  /** GET /attendance/by-teacher?days=30 — у кого группы держатся. */
  @Get('by-teacher')
  byTeacher(@Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number) {
    const { since, until } = this.range(days);
    return this.stats.byTeacher(since, until);
  }

  /**
   * GET /attendance/dropout-risk — студенты с тремя пропусками подряд.
   * Тот же список, что бот присылает менеджеру каждое утро.
   */
  @Get('dropout-risk')
  dropoutRisk() {
    return this.dropout.findAtRisk();
  }
}
