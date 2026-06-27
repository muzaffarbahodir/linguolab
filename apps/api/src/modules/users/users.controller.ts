import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Current user ──────────────────────────────────────────────────────────

  /** GET /users/me */
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.usersService.findMe(user.id);
  }

  /** PATCH /users/me */
  @Patch('me')
  updateMe(
    @CurrentUser() user: RequestUser,
    @Body()
    dto: {
      first_name?: string;
      last_name?: string;
      locale?: string;
      timezone?: string;
      avatar_url?: string;
      gender?: 'MALE' | 'FEMALE' | null;
      birth_date?: string | null;
    },
  ) {
    return this.usersService.updateMe(user.id, dto);
  }

  /** PATCH /users/me/onboard — self-service выбор роли + авто-активация */
  @Patch('me/onboard')
  onboard(@CurrentUser() user: RequestUser, @Body() dto: { role: Role }) {
    return this.usersService.onboardSelf(user.id, dto.role);
  }

  /** PATCH /users/me/discovery — сохранить ответы опроса подбора курса */
  @Patch('me/discovery')
  discovery(
    @CurrentUser() user: RequestUser,
    @Body()
    dto: {
      study_format?: 'ONLINE' | 'OFFLINE';
      study_mode?: 'INDIVIDUAL' | 'GROUP' | null;
      preferred_category?: string | null;
    },
  ) {
    return this.usersService.saveDiscovery(user.id, dto as never);
  }

  /** GET /users/me/progress */
  @Get('me/progress')
  progress(@CurrentUser() user: RequestUser) {
    return this.usersService.getProgress(user.id);
  }

  /** GET /users/me/stats */
  @Get('me/stats')
  studentStats(@CurrentUser() user: RequestUser) {
    return this.usersService.getStudentStats(user.id);
  }

  /** GET /users/me/lessons/recent */
  @Get('me/lessons/recent')
  recentLessons(@CurrentUser() user: RequestUser) {
    return this.usersService.getRecentLessons(user.id);
  }

  /** PATCH /users/me/notification-channels */
  @Patch('me/notification-channels')
  notificationChannels(
    @CurrentUser() user: RequestUser,
    @Body() dto: { telegram?: boolean; email?: boolean },
  ) {
    return this.usersService.updateNotificationChannels(user.id, dto);
  }

  // ─── Admin endpoints ────────────────────────────────────────────────────────

  /**
   * GET /users
   * Список всех пользователей. MANAGER / ADMIN / SUPER_ADMIN.
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.usersService.findAll(page, limit);
  }

  /**
   * GET /users/pending
   * Ожидающие активации. MANAGER / ADMIN / SUPER_ADMIN.
   */
  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  findPending() {
    return this.usersService.findPending();
  }

  /**
   * PATCH /users/:id/activate
   * Активировать пользователя (опционально с ролью).
   * MANAGER / ADMIN / SUPER_ADMIN.
   */
  @Patch(':id/activate')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  activate(@Param('id') id: string, @Body() dto: { role?: Role }) {
    return this.usersService.activateUser(id, dto.role);
  }

  /**
   * PATCH /users/:id/role
   * Изменить роль пользователя. MANAGER / ADMIN / SUPER_ADMIN.
   * (Повышение до ADMIN/SUPER_ADMIN — только ADMIN/SUPER_ADMIN.)
   */
  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  changeRole(
    @CurrentUser() actor: RequestUser,
    @Param('id') id: string,
    @Body() dto: { role: Role },
  ) {
    return this.usersService.changeRole(actor.role, id, dto.role);
  }
}
