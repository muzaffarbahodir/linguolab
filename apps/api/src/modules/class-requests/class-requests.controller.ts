import { Controller, Get, Post, Patch, Param, Body, Query, HttpCode } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { ClassRequestsService } from './class-requests.service';
import { CreateClassRequestDto } from './dto/create-class-request.dto';
import { ApproveClassRequestDto, RejectClassRequestDto } from './dto/review-class-request.dto';

@Controller('class-requests')
export class ClassRequestsController {
  constructor(private readonly service: ClassRequestsService) {}

  // ─── Teacher endpoints ──────────────────────────────────────────────────────

  /**
   * POST /class-requests
   * Учитель создаёт заявку на открытие нового курса.
   */
  @Post()
  @Roles(Role.TEACHER)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateClassRequestDto) {
    return this.service.create(user.id, dto);
  }

  /**
   * GET /class-requests/my
   * Учитель видит свои заявки.
   */
  @Get('my')
  @Roles(Role.TEACHER)
  findMy(@CurrentUser() user: RequestUser) {
    return this.service.findMy(user.id);
  }

  // ─── Manager/Admin endpoints ────────────────────────────────────────────────

  /**
   * GET /class-requests?status=PENDING
   * Менеджер/Админ видит все заявки.
   */
  @Get()
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  /**
   * GET /class-requests/:id
   */
  @Get(':id')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /**
   * PATCH /class-requests/:id/approve
   * Менеджер апрувит → создаёт Class в DRAFT с ценами и датами.
   */
  @Patch(':id/approve')
  @HttpCode(200)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  approve(@Param('id') id: string, @Body() dto: ApproveClassRequestDto) {
    return this.service.approve(id, dto);
  }

  /**
   * PATCH /class-requests/:id/reject
   * Менеджер отклоняет заявку с опциональным комментарием.
   */
  @Patch(':id/reject')
  @HttpCode(200)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  reject(@Param('id') id: string, @Body() dto: RejectClassRequestDto) {
    return this.service.reject(id, dto);
  }
}
