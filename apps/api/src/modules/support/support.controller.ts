import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { TicketStatus, Role } from '@prisma/client';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { SupportService } from './support.service';

class CreateTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;
}

class UpdateTicketStatusDto {
  @IsIn(['OPEN', 'IN_PROGRESS', 'CLOSED'])
  status!: TicketStatus;
}

@Controller('support')
export class SupportController {
  constructor(private readonly service: SupportService) {}

  /** POST /support/tickets — студент создаёт тикет */
  @Post('tickets')
  @Throttle({ short: { limit: 3, ttl: 60_000 }, medium: { limit: 5, ttl: 60_000 } })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateTicketDto) {
    return this.service.create(user.id, dto.subject, dto.message);
  }

  /** GET /support/tickets/my — мои тикеты (студент) */
  @Get('tickets/my')
  findMy(@CurrentUser() user: RequestUser) {
    return this.service.findMy(user.id);
  }

  /** GET /support/tickets — все тикеты (менеджер). ?status=OPEN|IN_PROGRESS|CLOSED */
  @Get('tickets')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  /** PATCH /support/tickets/:id/status — менеджер меняет статус */
  @Patch('tickets/:id/status')
  @HttpCode(200)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTicketStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }
}
