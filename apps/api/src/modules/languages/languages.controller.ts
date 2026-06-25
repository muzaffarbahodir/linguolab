import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { LanguagesService, type UpsertLanguageDto } from './languages.service';

@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  /** GET /languages — активные языки/курсы (студентам). */
  @Get()
  findAll() {
    return this.languagesService.findAll();
  }

  /** GET /languages/:id/course — страница курса: инфо + учителя/классы + рекомендация. */
  @Get(':id/course')
  getCourseDetail(@Param('id') id: string) {
    return this.languagesService.getCourseDetail(id);
  }

  // ─── Admin (SUPER_ADMIN) ──────────────────────────────────────────────────────

  /** GET /languages/admin/all — все языки, вкл. выключенные. */
  @Get('admin/all')
  @Roles(Role.SUPER_ADMIN)
  findAllAdmin() {
    return this.languagesService.findAllAdmin();
  }

  /** POST /languages — создать язык. */
  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: UpsertLanguageDto) {
    return this.languagesService.create(dto);
  }

  /** PATCH /languages/:id — обновить (картинка, описание, цвет и т.д.). */
  @Patch(':id')
  @Roles(Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpsertLanguageDto) {
    return this.languagesService.update(id, dto);
  }

  /** DELETE /languages/:id — удалить (или деактивировать, если есть курсы). */
  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.languagesService.remove(id);
  }
}
