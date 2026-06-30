import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { PointsService } from './points.service';

@Controller('points')
export class PointsController {
  constructor(private readonly points: PointsService) {}

  /** GET /points/me — баланс баллов, уровень, история. */
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.points.getMyPoints(user.id);
  }

  /** GET /points/leaderboard — топ по заработанным баллам. */
  @Get('leaderboard')
  leaderboard(@CurrentUser() user: RequestUser) {
    return this.points.getLeaderboard(user.id);
  }

  /** POST /points/admin/award — ручное начисление баллов (MANAGER/ADMIN+). */
  @Post('admin/award')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  async award(@Body() dto: { user_id: string; amount: number; description?: string }) {
    await this.points.awardBonus(dto.user_id, Number(dto.amount), dto.description);
    return { ok: true };
  }
}
