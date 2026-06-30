import { Controller, Get } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
}
