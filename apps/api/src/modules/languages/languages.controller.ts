import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import {
  LanguagesService,
  type UpsertLanguageDto,
  type UpsertLessonDto,
} from './languages.service';

@Controller('languages')
export class LanguagesController {
  constructor(private readonly languagesService: LanguagesService) {}

  /** GET /languages — активные языки/курсы (студентам). */
  @Get()
  findAll() {
    return this.languagesService.findAll();
  }

  /** GET /languages/:id/course — страница курса: инфо + учителя/классы + программа. */
  @Get(':id/course')
  getCourseDetail(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.languagesService.getCourseDetail(id, user.id);
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

  // ─── Программа курса (CourseLesson) ───────────────────────────────────────────

  /** GET /languages/:id/lessons/admin — все уроки направления для редактора. */
  @Get(':id/lessons/admin')
  @Roles(Role.SUPER_ADMIN)
  listLessonsAdmin(@Param('id') id: string) {
    return this.languagesService.listLessonsAdmin(id);
  }

  /** POST /languages/:id/lessons — добавить урок в программу. */
  @Post(':id/lessons')
  @Roles(Role.SUPER_ADMIN)
  createLesson(@Param('id') id: string, @Body() dto: UpsertLessonDto) {
    return this.languagesService.createLesson(id, dto);
  }

  /** PATCH /languages/lessons/:lessonId — обновить урок. */
  @Patch('lessons/:lessonId')
  @Roles(Role.SUPER_ADMIN)
  updateLesson(@Param('lessonId') lessonId: string, @Body() dto: UpsertLessonDto) {
    return this.languagesService.updateLesson(lessonId, dto);
  }

  /** DELETE /languages/lessons/:lessonId — удалить урок. */
  @Delete('lessons/:lessonId')
  @Roles(Role.SUPER_ADMIN)
  deleteLesson(@Param('lessonId') lessonId: string) {
    return this.languagesService.deleteLesson(lessonId);
  }
}
