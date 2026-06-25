import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsString, Length } from 'class-validator';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { Role } from '@prisma/client';
import { ReferralsService } from './referrals.service';

class RedeemDto {
  @IsString()
  @Length(6, 8)
  code!: string;
}

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  /** GET /referrals/my — получить или создать реферальный код */
  @Get('my')
  getOrCreate(@CurrentUser() user: RequestUser) {
    return this.service.getOrCreate(user.id);
  }

  /** POST /referrals/redeem — активировать чужой код */
  @Post('redeem')
  redeem(@CurrentUser() user: RequestUser, @Body() dto: RedeemDto) {
    return this.service.redeem(user.id, dto.code.toUpperCase());
  }

  /** GET /referrals/admin/stats — аналитика для MANAGER+ */
  @Get('admin/stats')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  adminStats() {
    return this.service.adminStats();
  }
}
