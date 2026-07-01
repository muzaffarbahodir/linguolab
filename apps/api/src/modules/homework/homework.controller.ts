import { Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client';

import { HomeworkService } from './homework.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { GradeHomeworkDto } from './dto/grade-homework.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

/** Роли, которым разрешено управлять ДЗ класса. */
const TEACHER_ROLES = [Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN];

@Controller('homework')
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  /** GET /homework/my — мои ДЗ (студент) */
  @Get('my')
  my(@Req() req: Request) {
    const user = req.user as { sub: string };
    return this.homework.listForStudent(user.sub);
  }

  /** GET /homework/class/:classId — ДЗ класса (учитель своего класса / менеджер+) */
  @Get('class/:classId')
  @Roles(...TEACHER_ROLES)
  byClass(@Param('classId') classId: string, @CurrentUser() user: RequestUser) {
    return this.homework.listByClass(classId, user);
  }

  /** POST /homework — создать ДЗ (учитель своего класса / менеджер+) */
  @Post()
  @Roles(...TEACHER_ROLES)
  create(@Body() dto: CreateHomeworkDto, @CurrentUser() user: RequestUser) {
    return this.homework.create(dto, user);
  }

  /** POST /homework/:id/submit — сдать ДЗ (студент, записанный в класс) */
  @Post(':id/submit')
  @Roles(Role.STUDENT)
  submit(@Param('id') id: string, @Body() dto: SubmitHomeworkDto, @Req() req: Request) {
    const user = req.user as { sub: string };
    return this.homework.submit(id, user.sub, dto);
  }

  /** GET /homework/:id/submissions — список сдач (учитель своего класса / менеджер+) */
  @Get(':id/submissions')
  @Roles(...TEACHER_ROLES)
  submissions(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.homework.listSubmissions(id, user);
  }

  /** PATCH /homework/submissions/:submissionId/grade — оценить (учитель своего класса / менеджер+) */
  @Patch('submissions/:submissionId/grade')
  @Roles(...TEACHER_ROLES)
  grade(
    @Param('submissionId') id: string,
    @Body() dto: GradeHomeworkDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.homework.grade(id, dto, user);
  }
}
