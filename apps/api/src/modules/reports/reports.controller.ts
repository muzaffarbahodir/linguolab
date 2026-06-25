import { Controller, Post, Get, HttpCode, Query, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /**
   * POST /reports/weekly/generate
   * Вручную запускает еженедельный отчёт (последние 7 дней).
   * Генерирует PDF, загружает в R2, отправляет всем SUPER_ADMIN.
   * Только SUPER_ADMIN.
   */
  @Post('weekly/generate')
  @HttpCode(200)
  @Roles(Role.SUPER_ADMIN)
  generateWeekly() {
    return this.reports.generateAndSend();
  }

  /**
   * GET /reports/generate?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Генерирует PDF за произвольный период.
   * Возвращает { pdf_url, label } — без отправки в TG.
   * ADMIN и SUPER_ADMIN могут вызывать в любой момент.
   *
   * @example GET /reports/generate?from=2026-06-01&to=2026-06-12
   */
  @Get('generate')
  @HttpCode(200)
  async generatePeriod(@Query('from') fromStr: string, @Query('to') toStr: string) {
    const from = new Date(fromStr);
    const to = new Date(toStr);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException('from and to must be valid ISO dates (YYYY-MM-DD)');
    }
    if (from > to) {
      throw new BadRequestException('from must be before to');
    }
    const diffDays = (to.getTime() - from.getTime()) / 86_400_000;
    if (diffDays > 366) {
      throw new BadRequestException('Period must not exceed 366 days');
    }

    // Set to to end-of-day
    to.setHours(23, 59, 59, 999);

    return this.reports.generatePeriodReport(from, to);
  }
}
