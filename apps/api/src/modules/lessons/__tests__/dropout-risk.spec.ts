/**
 * Риск оттока: три пропуска подряд.
 *
 * Цена ошибки здесь несимметрична. Пропустить уходящего студента — потерять
 * деньги. Но и ложная тревога дорога: менеджер звонит человеку, который
 * исправно ходит, и выглядит глупо. Поэтому проверяем обе стороны.
 */
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { DropoutRiskService } from '../dropout-risk.service';

const mockPrisma = {
  class: { findMany: jest.fn() },
  lessonAttendance: { findFirst: jest.fn() },
};
const mockNotifications = { notifyStaffNewRequest: jest.fn().mockResolvedValue(undefined) };

const STUDENT = {
  student_id: 's1',
  student: { first_name: 'Ali', last_name: 'Valiyev', telegram_username: 'ali' },
};

/** Группа с тремя подтверждёнными занятиями и заданными отметками студента. */
function classWith(statuses: (string | undefined)[], extraStudents: unknown[] = []) {
  return [
    {
      id: 'c1',
      title: 'English A1',
      enrollments: [STUDENT, ...extraStudents],
      lessons: statuses.map((st, i) => ({
        id: `l${i}`,
        scheduled_at: new Date(`2026-07-${20 - i}T10:00:00Z`),
        attendances: st === undefined ? [] : [{ student_id: 's1', status: st }],
      })),
    },
  ];
}

describe('DropoutRiskService', () => {
  let service: DropoutRiskService;

  beforeEach(async () => {
    jest.resetAllMocks();
    mockNotifications.notifyStaffNewRequest.mockResolvedValue(undefined);
    mockPrisma.lessonAttendance.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DropoutRiskService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(DropoutRiskService);
  });

  it('помечает три пропуска подряд', async () => {
    mockPrisma.class.findMany.mockResolvedValue(classWith(['ABSENT', 'ABSENT', 'ABSENT']));

    const risk = await service.findAtRisk();

    expect(risk).toHaveLength(1);
    expect(risk[0]!.student_name).toBe('Ali Valiyev');
    expect(risk[0]!.class_title).toBe('English A1');
  });

  it('не помечает, если студент был хотя бы на одном', async () => {
    mockPrisma.class.findMany.mockResolvedValue(classWith(['ABSENT', 'PRESENT', 'ABSENT']));
    expect(await service.findAtRisk()).toHaveLength(0);
  });

  it('опоздание — это посещение, а не пропуск', async () => {
    mockPrisma.class.findMany.mockResolvedValue(classWith(['ABSENT', 'LATE', 'ABSENT']));
    expect(await service.findAtRisk()).toHaveLength(0);
  });

  it('уважительный пропуск не считается уходом', async () => {
    mockPrisma.class.findMany.mockResolvedValue(classWith(['ABSENT', 'EXCUSED', 'ABSENT']));
    expect(await service.findAtRisk()).toHaveLength(0);
  });

  it('не помечает того, кого не отмечали — он записался позже', async () => {
    // Отсутствие отметки означает «его тогда ещё не было в группе»,
    // а не «он прогулял».
    mockPrisma.class.findMany.mockResolvedValue(classWith(['ABSENT', undefined, 'ABSENT']));
    expect(await service.findAtRisk()).toHaveLength(0);
  });

  it('молчит, пока в группе меньше трёх подтверждённых занятий', async () => {
    mockPrisma.class.findMany.mockResolvedValue(classWith(['ABSENT', 'ABSENT']));
    expect(await service.findAtRisk()).toHaveLength(0);
  });

  it('шлёт по одному уведомлению на студента и дедупит по группе', async () => {
    mockPrisma.class.findMany.mockResolvedValue(classWith(['ABSENT', 'ABSENT', 'ABSENT']));

    await service.runDaily();

    expect(mockNotifications.notifyStaffNewRequest).toHaveBeenCalledTimes(1);
    const [, , dedupKey] = mockNotifications.notifyStaffNewRequest.mock.calls[0]!;
    expect(dedupKey).toBe('dropout:s1:c1');
  });

  it('ничего не шлёт, когда рисков нет', async () => {
    mockPrisma.class.findMany.mockResolvedValue(classWith(['PRESENT', 'PRESENT', 'PRESENT']));

    await service.runDaily();

    expect(mockNotifications.notifyStaffNewRequest).not.toHaveBeenCalled();
  });
});
