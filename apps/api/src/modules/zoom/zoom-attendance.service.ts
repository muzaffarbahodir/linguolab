import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { matchParticipants } from './participant-matcher';
import { ZoomService } from './zoom.service';

/**
 * ZoomAttendanceService — превращает отчёт Zoom в посещаемость занятия.
 *
 * Это то место, ради которого затевалась вся интеграция. Раньше посещаемость
 * держалась на том, что преподаватель не забудет нажать кнопку; когда он
 * забывал, урок закрывался сам, данные терялись, а зарплата всё равно
 * начислялась. Zoom знает, кто был и сколько минут, — эту правду и берём.
 *
 * Осознанное ограничение: автоматика ставит только PRESENT. Отсутствующих не
 * помечает никогда — имя в Zoom ненадёжно, и студент, вошедший с чужого
 * ноутбука, не должен получить прогул, а его родители — уведомление о том,
 * чего не было. Кого не узнали, показываем преподавателю.
 */
@Injectable()
export class ZoomAttendanceService {
  private readonly logger = new Logger(ZoomAttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zoom: ZoomService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Конференция завершилась — подтягиваем отчёт и отмечаем тех, кого узнали.
   * Возвращает сводку (нужна тестам и логам).
   */
  async applyForMeeting(meetingId: string): Promise<{
    lesson_id: string;
    marked: number;
    unmatched: string[];
    missing: number;
  } | null> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { zoom_meeting_id: meetingId },
      select: {
        id: true,
        status: true,
        attendance_marked_at: true,
        class: {
          select: {
            id: true,
            title: true,
            teacher: { select: { user_id: true } },
            enrollments: {
              where: { status: 'ACTIVE' },
              select: {
                student: {
                  select: {
                    id: true,
                    first_name: true,
                    last_name: true,
                    telegram_username: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      this.logger.warn(`Zoom meeting ${meetingId} does not belong to any lesson`);
      return null;
    }

    // Преподаватель уже отметил руками — его решение важнее отчёта.
    if (lesson.attendance_marked_at) {
      this.logger.log(`Lesson ${lesson.id} already marked manually — skipping Zoom report`);
      return null;
    }

    const participants = await this.zoom.getParticipants(meetingId);
    if (!participants) return null;

    const students = lesson.class.enrollments.map((e) => e.student);
    const { matched, unmatched, missing } = matchParticipants(participants, students);

    if (matched.size === 0) {
      // Никого не узнали: молча закрывать урок нельзя, это выглядело бы как
      // «все прогуляли». Оставляем преподавателю.
      this.logger.warn(`Lesson ${lesson.id}: no participants matched, leaving to teacher`);
      return { lesson_id: lesson.id, marked: 0, unmatched, missing: missing.length };
    }

    await this.prisma.$transaction([
      ...[...matched.keys()].map((studentId) =>
        this.prisma.lessonAttendance.upsert({
          where: { lesson_id_student_id: { lesson_id: lesson.id, student_id: studentId } },
          create: {
            lesson_id: lesson.id,
            student_id: studentId,
            status: 'PRESENT',
            note: `Zoom: ${matched.get(studentId)} мин`,
          },
          // Отметку преподавателя не перетираем — только заполняем пустое.
          update: {},
        }),
      ),
      this.prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          status: 'COMPLETED',
          attendance_marked_at: new Date(),
          attendance_source: 'ZOOM',
        },
      }),
    ]);

    this.logger.log(
      `Lesson ${lesson.id}: marked ${matched.size} present from Zoom ` +
        `(${unmatched.length} unmatched, ${missing.length} missing)`,
    );

    // Преподавателю всё равно есть что доделать: отчёт не знает, кто болел,
    // а кто прогулял, и не узнаёт вошедших под чужим именем.
    if (unmatched.length > 0 || missing.length > 0) {
      await this.notifications.scheduleAttendanceReminder(
        lesson.class.teacher.user_id,
        lesson.class.title,
        lesson.id,
        new Date(),
      );
    }

    return {
      lesson_id: lesson.id,
      marked: matched.size,
      unmatched,
      missing: missing.length,
    };
  }

  /** Ссылка на облачную запись — студенты спрашивают её первым делом. */
  async saveRecording(meetingId: string, url: string): Promise<void> {
    const res = await this.prisma.lesson.updateMany({
      where: { zoom_meeting_id: meetingId },
      data: { zoom_recording_url: url },
    });
    if (res.count === 0) {
      this.logger.warn(`Recording for unknown meeting ${meetingId}`);
    }
  }
}
