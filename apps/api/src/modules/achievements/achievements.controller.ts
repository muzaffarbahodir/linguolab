import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

import { AchievementsService } from './achievements.service';

@Controller('achievements')
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  /** GET /achievements/my — мои достижения (разблокированные + заблокированные) */
  @Get('my')
  my(@Req() req: Request) {
    const user = req.user as { sub: string };
    return this.achievements.myAchievements(user.sub);
  }
}
