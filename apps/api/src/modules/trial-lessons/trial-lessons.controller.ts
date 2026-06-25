import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { TrialLessonsService } from './trial-lessons.service';

class RequestTrialDto {
  @IsString()
  language_id!: string;

  @IsOptional()
  @IsIn(['ONLINE', 'OFFLINE'])
  type?: 'ONLINE' | 'OFFLINE';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

class UpdateTrialStatusDto {
  @IsIn(['CONFIRMED', 'CANCELLED'])
  status!: 'CONFIRMED' | 'CANCELLED';
}

@Controller('trial-lessons')
export class TrialLessonsController {
  constructor(private readonly service: TrialLessonsService) {}

  /** POST /trial-lessons/request — студент создаёт заявку */
  @Post('request')
  @Throttle({ short: { limit: 3, ttl: 60_000 }, medium: { limit: 5, ttl: 60_000 } })
  request(@CurrentUser() user: RequestUser, @Body() dto: RequestTrialDto) {
    return this.service.request(user.id, dto.language_id, dto.type ?? 'ONLINE', dto.note);
  }

  /** GET /trial-lessons/my — мои заявки (студент) */
  @Get('my')
  findMy(@CurrentUser() user: RequestUser) {
    return this.service.findMy(user.id);
  }

  /** GET /trial-lessons — все заявки (менеджер). ?status=PENDING|CONFIRMED|CANCELLED */
  @Get()
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  /** PATCH /trial-lessons/:id/status — менеджер подтверждает/отменяет */
  @Patch(':id/status')
  @HttpCode(200)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTrialStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }
}
