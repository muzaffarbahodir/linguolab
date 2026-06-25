import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { HomeworkSubmissionStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';
import { CreateHomeworkDto } from './dto/create-homework.dto';
import { SubmitHomeworkDto } from './dto/submit-homework.dto';
import { GradeHomeworkDto } from './dto/grade-homework.dto';

@Injectable()
export class HomeworkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly achievements: AchievementsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Создать ДЗ (учитель / менеджер) */
  async create(dto: CreateHomeworkDto) {
    const homework = await this.prisma.homework.create({
      data: {
        class_id: dto.class_id,
        title: dto.title,
        description: dto.description,
        due_date: dto.due_date ? new Date(dto.due_date) : undefined,
      },
    });

    // Уведомление всем студентам класса (один вызов — внутри перебирает enrolled)
    void this.notifications.scheduleHomeworkNew(dto.class_id, homework.id, homework.title);

    // Уведомление родителям каждого студента
    const enrollments = await this.prisma.enrollment.findMany({
      where: { class_id: dto.class_id, status: 'ACTIVE' },
      include: { student: { select: { id: true, first_name: true, last_name: true } } },
    });
    const cls = await this.prisma.class.findUnique({
      where: { id: dto.class_id },
      select: { title: true },
    });

    for (const { student } of enrollments) {
      const childName = `${student.first_name}${student.last_name ? ' ' + student.last_name : ''}`;
      void this.notifications.notifyParentsOfHomeworkNew(
        student.id,
        childName,
        cls?.title ?? '',
        homework.id,
        homework.title,
      );
    }

    return homework;
  }

  /** Список ДЗ для класса */
  async listByClass(classId: string) {
    return this.prisma.homework.findMany({
      where: { class_id: classId },
      orderBy: { due_date: 'asc' },
    });
  }

  /** Мои ДЗ (все классы студента) */
  async listForStudent(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { student_id: studentId, status: 'ACTIVE' },
      select: { class_id: true },
    });
    const classIds = enrollments.map((e) => e.class_id);

    const homeworks = await this.prisma.homework.findMany({
      where: { class_id: { in: classIds } },
      include: {
        class: {
          select: { title: true, language: { select: { flag_emoji: true, name_ru: true } } },
        },
        submissions: { where: { student_id: studentId }, select: { status: true, grade: true } },
      },
      orderBy: { due_date: 'asc' },
    });

    return homeworks.map((hw: (typeof homeworks)[number]) => ({
      ...hw,
      my_submission: hw.submissions[0] ?? null,
      submissions: undefined,
    }));
  }

  /** Сдать ДЗ (студент) */
  async submit(homeworkId: string, studentId: string, dto: SubmitHomeworkDto) {
    if (!dto.file_key && !dto.text_answer) {
      throw new BadRequestException('Provide file_key or text_answer');
    }

    const hw = await this.prisma.homework.findUnique({ where: { id: homeworkId } });
    if (!hw) throw new NotFoundException('Homework not found');

    const existing = await this.prisma.homeworkSubmission.findUnique({
      where: { homework_id_student_id: { homework_id: homeworkId, student_id: studentId } },
    });
    if (existing) throw new ConflictException('Already submitted');

    const isLate = hw.due_date ? new Date() > hw.due_date : false;
    const submission = await this.prisma.homeworkSubmission.create({
      data: {
        homework_id: homeworkId,
        student_id: studentId,
        file_key: dto.file_key,
        file_url: dto.file_url,
        text_answer: dto.text_answer,
        status: isLate ? HomeworkSubmissionStatus.LATE : HomeworkSubmissionStatus.SUBMITTED,
      },
    });

    // Триггер достижений
    await this.achievements.onHomeworkSubmitted(studentId);

    return submission;
  }

  /** Выставить оценку (учитель) */
  async grade(submissionId: string, dto: GradeHomeworkDto) {
    const submission = await this.prisma.homeworkSubmission.findUnique({
      where: { id: submissionId },
      include: {
        homework: { select: { title: true, class_id: true } },
        student: { select: { id: true, first_name: true, last_name: true } },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const updated = await this.prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: {
        grade: dto.grade,
        feedback: dto.feedback,
        status: HomeworkSubmissionStatus.GRADED,
        graded_at: new Date(),
      },
    });

    // 100 баллов → достижение
    if (dto.grade === 100) {
      await this.achievements.onPerfectGrade(submission.student_id);
    }

    // Уведомление студенту об оценке (fire-and-forget)
    void this.notifications.send({
      userId: submission.student_id,
      type: NotificationType.GRADE_RECEIVED,
      title: '📝 Оценка за домашнее задание',
      body:
        `Задание: ${submission.homework.title}\n` +
        `Оценка: <b>${dto.grade}/100</b>` +
        (dto.feedback ? `\nКомментарий: ${dto.feedback}` : ''),
      dedupKey: `notif:dedup:grade_received:${submissionId}`,
      dedupTtlSec: 86_400,
      payload: { submissionId, grade: dto.grade },
    });

    // Уведомление родителям ребёнка (fire-and-forget)
    const childName =
      `${submission.student.first_name}` +
      (submission.student.last_name ? ` ${submission.student.last_name}` : '');
    void this.notifications.notifyParentsOfGrade(
      submission.student_id,
      childName,
      submissionId,
      submission.homework.title,
      dto.grade,
      dto.feedback,
    );

    return updated;
  }

  /** Список сданных работ для ДЗ (учитель) */
  async listSubmissions(homeworkId: string) {
    return this.prisma.homeworkSubmission.findMany({
      where: { homework_id: homeworkId },
      include: { student: { select: { id: true, first_name: true, last_name: true } } },
      orderBy: { submitted_at: 'asc' },
    });
  }
}
