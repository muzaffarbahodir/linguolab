import { Controller, Get, Post, Patch, Body, Param, Req } from '@nestjs/common';
import { Request } from 'express';

import { HomeworkService } from './homework.service';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { GradeHomeworkDto } from './dto/grade-homework.dto';

@Controller('homework')
export class HomeworkController {
  constructor(private readonly homework: HomeworkService) {}

  /** GET /homework/my — мои ДЗ (студент) */
  @Get('my')
  my(@Req() req: Request) {
    const user = req.user as { sub: string };
    return this.homework.listForStudent(user.sub);
  }

  /** GET /homework/class/:classId — ДЗ класса */
  @Get('class/:classId')
  byClass(@Param('classId') classId: string) {
    return this.homework.listByClass(classId);
  }

  /** POST /homework — создать ДЗ */
  @Post()
  create(@Body() dto: CreateHomeworkDto) {
    return this.homework.create(dto);
  }

  /** POST /homework/:id/submit — сдать ДЗ */
  @Post(':id/submit')
  submit(@Param('id') id: string, @Body() dto: SubmitHomeworkDto, @Req() req: Request) {
    const user = req.user as { sub: string };
    return this.homework.submit(id, user.sub, dto);
  }

  /** GET /homework/:id/submissions — список сдач (учитель) */
  @Get(':id/submissions')
  submissions(@Param('id') id: string) {
    return this.homework.listSubmissions(id);
  }

  /** PATCH /homework/submissions/:submissionId/grade — оценить */
  @Patch('submissions/:submissionId/grade')
  grade(@Param('submissionId') id: string, @Body() dto: GradeHomeworkDto) {
    return this.homework.grade(id, dto);
  }
}
