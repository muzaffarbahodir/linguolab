/**
 * Посещаемость: подтверждение занятия и напоминания.
 *
 * Раньше урок, который учитель не отметил, через грейс становился COMPLETED —
 * неотличимо от подтверждённого. Он попадал в зарплату PER_LESSON, а
 * напоминание «отметьте посещаемость» искало только SCHEDULED, поэтому после
 * авто-закрытия переставало приходить и данные терялись навсегда.
 *
 * Факт подтверждения теперь несёт attendance_marked_at, а не статус.
 */
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { ZoomService } from '../../zoom/zoom.service';
import { LessonsService } from '../lessons.service';

const mockPrisma = {
  lesson: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  lessonAttendance: { upsert: jest.fn() },
  user: { findMany: jest.fn() },
};

const mockNotifications = {
  scheduleAttendanceReminder: jest.fn().mockResolvedValue(undefined),
  notifyParentsOfAbsent: jest.fn().mockResolvedValue(undefined),
};
const mockAnalytics = { track: jest.fn().mockResolvedValue(undefined) };
// Zoom не подключён — сервис выключен, конференции не создаются.
const mockZoom = { isConfigured: false, createMeeting: jest.fn() };

const TEACHER_USER_ID = 'teacher-user-1';

function lessonFixture(over: Record<string, unknown> = {}) {
  return {
    id: 'lesson-1',
    class_id: 'class-1',
    status: 'SCHEDULED',
    scheduled_at: new Date('2026-07-20T10:00:00Z'),
    attendance_marked_at: null,
    class: { id: 'class-1', title: 'English A1', teacher_id: 'teacher-1', teacher: {} },
    ...over,
  };
}

describe('LessonsService — подтверждение посещаемости', () => {
  let service: LessonsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockNotifications.scheduleAttendanceReminder.mockResolvedValue(undefined);
    mockNotifications.notifyParentsOfAbsent.mockResolvedValue(undefined);
    mockAnalytics.track.mockResolvedValue(undefined);
    mockPrisma.lessonAttendance.upsert.mockResolvedValue({});
    mockPrisma.user.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: AnalyticsService, useValue: mockAnalytics },
        { provide: ZoomService, useValue: mockZoom },
      ],
    }).compile();

    service = module.get(LessonsService);
  });

  describe('bulkAttendance', () => {
    it('проставляет attendance_marked_at — это и есть подтверждение занятия', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonFixture());

      await service.bulkAttendance('lesson-1', TEACHER_USER_ID, 'MANAGER' as never, [
        { studentId: 's1', status: 'PRESENT' },
      ]);

      const update = mockPrisma.lesson.update.mock.calls[0]![0];
      expect(update.data.status).toBe('COMPLETED');
      expect(update.data.attendance_marked_at).toBeInstanceOf(Date);
    });

    it('подтверждает урок, уже закрытый авто-джобом — иначе данные не вернуть', async () => {
      // Именно этот случай раньше терялся: статус уже COMPLETED, старый код
      // не обновлял ничего, и урок навсегда оставался неподтверждённым.
      mockPrisma.lesson.findUnique.mockResolvedValue(
        lessonFixture({ status: 'COMPLETED', attendance_marked_at: null }),
      );

      await service.bulkAttendance('lesson-1', TEACHER_USER_ID, 'MANAGER' as never, [
        { studentId: 's1', status: 'PRESENT' },
      ]);

      expect(mockPrisma.lesson.update).toHaveBeenCalledTimes(1);
      expect(mockPrisma.lesson.update.mock.calls[0]![0].data.attendance_marked_at).toBeInstanceOf(
        Date,
      );
    });

    it('пишет событие на каждого студента, а не одно на урок', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonFixture());

      await service.bulkAttendance('lesson-1', TEACHER_USER_ID, 'MANAGER' as never, [
        { studentId: 's1', status: 'PRESENT' },
        { studentId: 's2', status: 'ABSENT' },
        { studentId: 's3', status: 'LATE' },
      ]);

      const attendEvents = mockAnalytics.track.mock.calls.filter((c) => c[0] === 'lesson_attend');
      expect(attendEvents).toHaveLength(3);
      expect(attendEvents.map((c) => c[1].userId).sort()).toEqual(['s1', 's2', 's3']);
      expect(attendEvents.map((c) => c[1].properties.status).sort()).toEqual([
        'ABSENT',
        'LATE',
        'PRESENT',
      ]);
    });

    it('отменённый урок посещаемости не имеет', async () => {
      mockPrisma.lesson.findUnique.mockResolvedValue(lessonFixture({ status: 'CANCELLED' }));

      await expect(
        service.bulkAttendance('lesson-1', TEACHER_USER_ID, 'MANAGER' as never, [
          { studentId: 's1', status: 'PRESENT' },
        ]),
      ).rejects.toThrow();
      expect(mockPrisma.lesson.update).not.toHaveBeenCalled();
    });
  });

  describe('remindUnmarkedAttendance', () => {
    it('ищет по отсутствию отметки и охватывает авто-закрытые уроки', async () => {
      mockPrisma.lesson.findMany.mockResolvedValue([]);

      await service.remindUnmarkedAttendance();

      const where = mockPrisma.lesson.findMany.mock.calls[0]![0].where;
      // Признак «не отмечено» — дата, а не статус.
      expect(where.attendance_marked_at).toBeNull();
      // Урок, закрытый авто-джобом, обязан остаться в выборке.
      expect(where.status.in).toContain('COMPLETED');
      expect(where.status.in).toContain('SCHEDULED');
    });

    it('напоминает дольше, чем живёт грейс авто-закрытия', async () => {
      mockPrisma.lesson.findMany.mockResolvedValue([]);

      await service.remindUnmarkedAttendance();

      const { gte, lt } = mockPrisma.lesson.findMany.mock.calls[0]![0].where.scheduled_at;
      const windowHours = (lt.getTime() - gte.getTime()) / 3_600_000;
      // Грейс авто-закрытия — 6ч. Окно напоминаний должно его пережить,
      // иначе после авто-закрытия учитель перестаёт получать пинги.
      expect(windowHours).toBeGreaterThan(6);
    });

    it('ставит по одному напоминанию на найденный урок', async () => {
      mockPrisma.lesson.findMany.mockResolvedValue([
        {
          id: 'l1',
          scheduled_at: new Date('2026-07-20T10:00:00Z'),
          class: { title: 'English A1', teacher: { user_id: TEACHER_USER_ID } },
        },
        {
          id: 'l2',
          scheduled_at: new Date('2026-07-20T12:00:00Z'),
          class: { title: 'German A2', teacher: { user_id: 'teacher-user-2' } },
        },
      ]);

      await service.remindUnmarkedAttendance();

      expect(mockNotifications.scheduleAttendanceReminder).toHaveBeenCalledTimes(2);
    });
  });

  describe('autoCompleteStaleLessons', () => {
    it('закрывает урок, но подтверждением это не считает', async () => {
      mockPrisma.lesson.updateMany.mockResolvedValue({ count: 3 });

      await service.autoCompleteStaleLessons();

      const call = mockPrisma.lesson.updateMany.mock.calls[0]![0];
      expect(call.data.status).toBe('COMPLETED');
      // Ключевое: авто-закрытие не имеет права выдавать себя за отметку учителя.
      expect(call.data.attendance_marked_at).toBeUndefined();
      expect(call.where.status).toBe('SCHEDULED');
    });
  });
});
