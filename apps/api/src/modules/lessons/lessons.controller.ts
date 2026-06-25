import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { LessonsService } from './lessons.service';

class CreateLessonDto {
  classId!: string;
  title?: string;
  scheduledAt!: string; // ISO datetime string
  durationMin?: number;
  notes?: string;
}

class BulkAttendanceDto {
  attendances!: Array<{
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    note?: string;
  }>;
}

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  /**
   * GET /lessons/upcoming — ближайший урок авторизованного студента.
   */
  @Get('upcoming')
  upcoming(@CurrentUser() user: RequestUser) {
    return this.lessonsService.getUpcoming(user.id);
  }

  /**
   * GET /lessons/history — прошедшие уроки студента.
   */
  @Get('history')
  history(@CurrentUser() user: RequestUser) {
    return this.lessonsService.getHistory(user.id);
  }

  /**
   * GET /lessons/upcoming-list?limit=10 — список ближайших уроков студента.
   */
  @Get('upcoming-list')
  upcomingList(@CurrentUser() user: RequestUser, @Query('limit') limit?: string) {
    return this.lessonsService.getUpcomingList(user.id, limit ? parseInt(limit, 10) : 10);
  }

  /**
   * GET /lessons/attendance/my — посещаемость студента по классам.
   */
  @Get('attendance/my')
  myAttendance(@CurrentUser() user: RequestUser) {
    return this.lessonsService.getMyAttendance(user.id);
  }

  /**
   * GET /lessons/teacher/stats — сводная статистика учителя.
   */
  @Get('teacher/stats')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  teacherStats(@CurrentUser() user: RequestUser) {
    return this.lessonsService.getTeacherStats(user.id);
  }

  /**
   * GET /lessons/teacher/today — уроки учителя на сегодня (UTC+5).
   */
  @Get('teacher/today')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  teacherToday(@CurrentUser() user: RequestUser) {
    return this.lessonsService.getTodayLessons(user.id);
  }

  /**
   * GET /lessons/teacher/pending-hw — ДЗ на проверке у учителя.
   */
  @Get('teacher/pending-hw')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  teacherPendingHw(@CurrentUser() user: RequestUser) {
    return this.lessonsService.getPendingHomework(user.id);
  }

  /**
   * GET /lessons/:id — детали урока.
   */
  @Get(':id')
  getOne(@Param('id') lessonId: string) {
    return this.lessonsService.getOne(lessonId);
  }

  /**
   * POST /lessons — создать занятие (TEACHER | MANAGER | ADMIN).
   */
  @Post()
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateLessonDto) {
    return this.lessonsService.createLesson(user.id, user.role, dto);
  }

  /**
   * GET /lessons/class/:classId — уроки класса.
   */
  @Get('class/:classId')
  classLessons(@Param('classId') classId: string) {
    return this.lessonsService.getClassLessons(classId);
  }

  /**
   * POST /lessons/class/:classId/generate — генерация уроков по расписанию.
   * Body: { weeks?: number } — на сколько недель (по умолчанию 4).
   */
  @Post('class/:classId/generate')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  generateLessons(
    @CurrentUser() user: RequestUser,
    @Param('classId') classId: string,
    @Body('weeks') weeks?: number,
  ) {
    return this.lessonsService.generateLessons(classId, user.id, user.role, weeks ?? 4);
  }

  /**
   * POST /lessons/:id/attendance/bulk — массово отметить посещаемость.
   */
  @Post(':id/attendance/bulk')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  bulkAttendance(
    @CurrentUser() user: RequestUser,
    @Param('id') lessonId: string,
    @Body() dto: BulkAttendanceDto,
  ) {
    return this.lessonsService.bulkAttendance(lessonId, user.id, user.role, dto.attendances);
  }

  /**
   * GET /lessons/:id/attendance — посещаемость конкретного урока.
   */
  @Get(':id/attendance')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  getAttendance(@Param('id') lessonId: string) {
    return this.lessonsService.getLessonAttendance(lessonId);
  }
}
