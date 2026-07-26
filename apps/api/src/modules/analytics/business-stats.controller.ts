import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { BusinessStatsService } from './business-stats.service';

/**
 * Удержание и рентабельность. Только ADMIN+: выручка и стоимость
 * преподавателей — те же чувствительные данные, что в HR-разделе.
 */
@Controller('admin/analytics/business')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class BusinessStatsController {
  constructor(private readonly stats: BusinessStatsService) {}

  /**
   * GET /admin/analytics/business/retention?months=6
   * Из тех, кто записался в месяц X, сколько ещё учится через 1–3 месяца.
   */
  @Get('retention')
  retention(@Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number) {
    return this.stats.retention(Math.min(Math.max(months, 1), 24));
  }

  /**
   * GET /admin/analytics/business/class-profit?days=90
   * Выручка минус стоимость преподавателя по каждой группе, убыточные сверху.
   * Период по умолчанию — квартал: за месяц у групп с редким расписанием
   * слишком мало занятий, чтобы цифра что-то значила.
   */
  @Get('class-profit')
  classProfit(@Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number) {
    const until = new Date();
    const since = new Date(until.getTime() - Math.min(Math.max(days, 1), 730) * 86_400_000);
    return this.stats.classProfitability(since, until);
  }
}
