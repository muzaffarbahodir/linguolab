import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { CEFR, Role } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ActiveUserGuard } from '../auth/guards/active-user.guard';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { ClassesService } from './classes.service';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  /** GET /classes?languageId=xxx&level=A1 */
  @Get()
  findAll(@Query('languageId') languageId?: string, @Query('level') level?: CEFR) {
    return this.classesService.findAll(languageId, level);
  }

  /**
   * GET /classes/my — классы текущего учителя (или все для MANAGER+).
   * Должен быть ДО :id чтобы не перехватываться как параметр.
   */
  @Get('my')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  getMyClasses(@CurrentUser() user: RequestUser) {
    return this.classesService.getMyClasses(user.id, user.role);
  }

  /**
   * GET /classes/:classId/students — активные студенты класса.
   */
  @Get(':classId/students')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  getClassStudents(@Param('classId') classId: string) {
    return this.classesService.getClassStudents(classId);
  }

  /**
   * GET /classes/:classId/student-stats — посещаемость и ДЗ по каждому студенту.
   */
  @Get(':classId/student-stats')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  getClassStudentStats(@Param('classId') classId: string) {
    return this.classesService.getClassStudentStats(classId);
  }

  /**
   * GET /classes/:classId/students/:studentId/overview
   * Учитель смотрит детальную статистику конкретного студента.
   */
  @Get(':classId/students/:studentId/overview')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  getStudentOverview(
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.classesService.getStudentOverview(user.id, classId, studentId);
  }

  /**
   * GET /classes/:classId/students/:studentId/attendance
   * Учитель смотрит посещаемость студента.
   */
  @Get(':classId/students/:studentId/attendance')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  getStudentAttendance(
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.classesService.getStudentAttendanceForTeacher(user.id, classId, studentId);
  }

  /**
   * GET /classes/:classId/students/:studentId/homework
   * Учитель смотрит домашние задания студента.
   */
  @Get(':classId/students/:studentId/homework')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  getStudentHomework(
    @Param('classId') classId: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.classesService.getStudentHomeworkForTeacher(user.id, classId, studentId);
  }

  /**
   * GET /classes/:classId/teacher/rating — рейтинг учителя класса (публичный).
   */
  @Get(':classId/teacher/rating')
  getTeacherRating(@Param('classId') classId: string) {
    return this.classesService.getTeacherRating(classId);
  }

  /**
   * GET /classes/:classId/my-rating — текущая оценка студента для данного класса.
   */
  @Get(':classId/my-rating')
  @Roles(Role.STUDENT)
  getMyRating(@Param('classId') classId: string, @CurrentUser() user: RequestUser) {
    return this.classesService.getMyRating(user.id, classId);
  }

  /**
   * POST /classes/:classId/rate — студент оценивает учителя.
   * Body: { rating: 1-5, comment?: string }
   */
  @Post(':classId/rate')
  @Roles(Role.STUDENT)
  rateTeacher(
    @Param('classId') classId: string,
    @Body('rating') rating: number,
    @Body('comment') comment: string | undefined,
    @CurrentUser() user: RequestUser,
  ) {
    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestException('rating must be 1-5');
    }
    return this.classesService.rateTeacher(user.id, classId, Number(rating), comment);
  }

  /** GET /classes/:id */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.classesService.findOne(id);
  }

  /** POST /classes/:id/enroll */
  @Post(':id/enroll')
  @UseGuards(ActiveUserGuard)
  enroll(@Param('id') classId: string, @CurrentUser() user: RequestUser) {
    return this.classesService.enroll(classId, user.id);
  }

  /**
   * POST /classes/:id/waitlist — студент встаёт в очередь на полный класс.
   */
  @Post(':id/waitlist')
  @Roles(Role.STUDENT)
  @UseGuards(ActiveUserGuard)
  joinWaitlist(@Param('id') classId: string, @CurrentUser() user: RequestUser) {
    return this.classesService.joinWaitlist(classId, user.id);
  }

  /**
   * DELETE /classes/:id/waitlist — студент покидает очередь.
   */
  @Delete(':id/waitlist')
  @Roles(Role.STUDENT)
  leaveWaitlist(@Param('id') classId: string, @CurrentUser() user: RequestUser) {
    return this.classesService.leaveWaitlist(classId, user.id);
  }

  /**
   * PATCH /classes/:id/schedule — менеджер задаёт расписание.
   * Body: { schedule_days: string[], schedule_time: string, schedule_duration: number }
   */
  @Patch(':id/schedule')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  setSchedule(
    @Param('id') classId: string,
    @Body('schedule_days') days: string[],
    @Body('schedule_time') time: string,
    @Body('schedule_duration') duration: number,
  ) {
    if (!days?.length || !time || !duration) {
      throw new BadRequestException('schedule_days, schedule_time, schedule_duration are required');
    }
    return this.classesService.setSchedule(classId, days, time, Number(duration));
  }

  /**
   * PATCH /classes/:id/group — менеджер привязывает Telegram-группу.
   * Body: { telegram_chat_id: "-1001234567890" }
   * chat_id группы — отрицательное число, передаём как строку.
   */
  @Patch(':id/group')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  setTelegramGroup(@Param('id') classId: string, @Body('telegram_chat_id') chatId: string) {
    if (!chatId) throw new BadRequestException('telegram_chat_id is required');
    return this.classesService.setTelegramGroup(classId, chatId);
  }

  /**
   * PATCH /classes/:id/meeting — учитель (свой класс) или менеджер задаёт Zoom-ссылку.
   * Body: { meeting_url: "https://zoom.us/j/..." }
   */
  @Patch(':id/meeting')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  setMeetingUrl(
    @Param('id') classId: string,
    @Body('meeting_url') meetingUrl: string,
    @CurrentUser() user: RequestUser,
  ) {
    const teacherUserId = user.role === Role.TEACHER ? user.id : undefined;
    return this.classesService.setMeetingUrl(classId, meetingUrl ?? '', teacherUserId);
  }
}
