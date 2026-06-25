import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { AnnouncementsService, type UpsertAnnouncementDto } from './announcements.service';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  /** GET /announcements/active — активные баннеры для текущего пользователя. */
  @Get('active')
  active(@CurrentUser() user: RequestUser) {
    return this.service.findActive(user.role, user.id);
  }

  // ─── Admin (SUPER_ADMIN) ──────────────────────────────────────────────────────

  /** GET /announcements — все баннеры. */
  @Get()
  @Roles(Role.SUPER_ADMIN)
  findAll() {
    return this.service.findAllAdmin();
  }

  /** POST /announcements — создать. */
  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: UpsertAnnouncementDto) {
    return this.service.create(dto);
  }

  /** PATCH /announcements/:id — обновить. */
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpsertAnnouncementDto) {
    return this.service.update(id, dto);
  }

  /** DELETE /announcements/:id — удалить. */
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
