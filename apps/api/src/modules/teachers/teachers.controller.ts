import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { TeachersService } from './teachers.service';

@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  /**
   * GET /teachers — список всех учителей (публичный).
   */
  @Get()
  @Public()
  findAll() {
    return this.teachersService.findAll();
  }

  /**
   * GET /teachers/by-user/:userId — профиль учителя по user_id.
   */
  @Get('by-user/:userId')
  @Public()
  findByUserId(@Param('userId') userId: string) {
    return this.teachersService.findByUserId(userId);
  }

  /**
   * PATCH /teachers/profile — учитель обновляет свой профиль.
   * Body: { bio?, photo_url?, website_url?, instagram_url?, telegram_url? }
   */
  @Patch('profile')
  @Roles(Role.TEACHER)
  updateProfile(
    @CurrentUser() user: RequestUser,
    @Body()
    body: {
      bio?: string;
      photo_url?: string | null;
      website_url?: string;
      instagram_url?: string;
      telegram_url?: string;
    },
  ) {
    return this.teachersService.updateProfile(user.id, body);
  }

  /**
   * DELETE /teachers/badges/:badgeId — удалить бейдж.
   */
  @Delete('badges/:badgeId')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  removeBadge(@Param('badgeId') badgeId: string) {
    return this.teachersService.removeBadge(badgeId);
  }

  /**
   * GET /teachers/:teacherId — публичный профиль учителя.
   * Должен быть ПОСЛЕ специфичных маршрутов (by-user, profile, badges).
   */
  @Get(':teacherId')
  @Public()
  findOne(@Param('teacherId') teacherId: string) {
    return this.teachersService.findOne(teacherId);
  }

  /**
   * POST /teachers/:teacherId/rate — студент оставляет оценку.
   * Body: { class_id, rating (1-5), comment? }
   */
  @Post(':teacherId/rate')
  @Roles(Role.STUDENT)
  rateTeacher(
    @Param('teacherId') teacherId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { class_id: string; rating: number; comment?: string },
  ) {
    if (!body.class_id || !body.rating) {
      throw new BadRequestException('class_id and rating are required');
    }
    return this.teachersService.rateTeacher(user.id, teacherId, body);
  }

  /**
   * GET /teachers/:teacherId/my-rating — текущая оценка студента для учителя.
   */
  @Get(':teacherId/my-rating')
  @Roles(Role.STUDENT)
  getMyRating(@Param('teacherId') teacherId: string, @CurrentUser() user: RequestUser) {
    return this.teachersService.getMyRating(user.id, teacherId);
  }

  /**
   * POST /teachers/:teacherId/badges — менеджер/админ выдаёт бейдж.
   * Body: { title, description?, icon, type? }
   */
  @Post(':teacherId/badges')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  awardBadge(
    @Param('teacherId') teacherId: string,
    @CurrentUser() user: RequestUser,
    @Body() body: { title: string; description?: string; icon: string; type?: string },
  ) {
    if (!body.title || !body.icon) {
      throw new BadRequestException('title and icon are required');
    }
    return this.teachersService.awardBadge(teacherId, user.id, body);
  }
}
