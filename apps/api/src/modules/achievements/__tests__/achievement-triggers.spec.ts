/**
 * Достижения выдаются там, где происходит событие.
 *
 * Тест написан по следам живой поломки: методы onEnrollment, onTrialCompleted
 * и onReferral существовали с самого начала, но их никто не вызывал — четыре
 * достижения из семи не получал никто и никогда, и на экране «Достижения»
 * висели вечно заблокированные карточки.
 *
 * Такую ошибку не ловит ни типизация, ни линтер: код компилируется и работает,
 * просто ничего не делает. Поэтому проверяем факт вызова.
 */
import { AchievementTrigger } from '@prisma/client';

import { AchievementsService } from '../achievements.service';

describe('AchievementsService.unlock', () => {
  const mockPrisma = {
    achievement: { findFirst: jest.fn(), findMany: jest.fn() },
    userAchievement: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    homeworkSubmission: { count: jest.fn() },
  };

  let service: AchievementsService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AchievementsService(mockPrisma as never);
  });

  it('выдаёт достижение за первую запись в класс', async () => {
    mockPrisma.achievement.findFirst.mockResolvedValue({ id: 'a1' });
    mockPrisma.userAchievement.findUnique.mockResolvedValue(null);

    await service.onEnrollment('u1');

    expect(mockPrisma.achievement.findFirst).toHaveBeenCalledWith({
      where: { trigger: AchievementTrigger.FIRST_ENROLLMENT },
    });
    expect(mockPrisma.userAchievement.create).toHaveBeenCalledWith({
      data: { user_id: 'u1', achievement_id: 'a1' },
    });
  });

  it('не выдаёт то же достижение дважды', async () => {
    mockPrisma.achievement.findFirst.mockResolvedValue({ id: 'a1' });
    mockPrisma.userAchievement.findUnique.mockResolvedValue({ id: 'ua1' });

    await service.onEnrollment('u1');

    expect(mockPrisma.userAchievement.create).not.toHaveBeenCalled();
  });

  it('молчит, если достижение с таким триггером не заведено', async () => {
    // Список достижений наполняется сидом, и на свежей базе его может не быть.
    // Падать из-за этого запись на курс не должна.
    mockPrisma.achievement.findFirst.mockResolvedValue(null);

    await expect(service.onEnrollment('u1')).resolves.toBeUndefined();
    expect(mockPrisma.userAchievement.create).not.toHaveBeenCalled();
  });

  it('за пятую и десятую домашку выдаёт обе серии разом', async () => {
    mockPrisma.achievement.findFirst.mockResolvedValue({ id: 'a1' });
    mockPrisma.userAchievement.findUnique.mockResolvedValue(null);
    mockPrisma.homeworkSubmission.count.mockResolvedValue(10);

    await service.onHomeworkSubmitted('u1');

    const triggers = mockPrisma.achievement.findFirst.mock.calls.map(
      (c) => (c[0] as { where: { trigger: string } }).where.trigger,
    );
    expect(triggers).toEqual([
      AchievementTrigger.FIRST_HOMEWORK,
      AchievementTrigger.HOMEWORK_STREAK_5,
      AchievementTrigger.HOMEWORK_STREAK_10,
    ]);
  });

  it('на четвёртой домашке серию ещё не выдаёт', async () => {
    mockPrisma.achievement.findFirst.mockResolvedValue({ id: 'a1' });
    mockPrisma.userAchievement.findUnique.mockResolvedValue(null);
    mockPrisma.homeworkSubmission.count.mockResolvedValue(4);

    await service.onHomeworkSubmitted('u1');

    const triggers = mockPrisma.achievement.findFirst.mock.calls.map(
      (c) => (c[0] as { where: { trigger: string } }).where.trigger,
    );
    expect(triggers).toEqual([AchievementTrigger.FIRST_HOMEWORK]);
  });
});

/**
 * Каждый триггер должен быть кем-то вызван.
 *
 * Проверка сознательно грубая — обходим исходники и ищем вызовы. Точный тест
 * на каждое место потребовал бы поднимать половину модулей, а поймать нужно
 * ровно одно: появился триггер, а дёрнуть его забыли.
 */
describe('связь триггеров с кодом', () => {
  it('у каждого метода достижения есть вызов вне самого сервиса', async () => {
    const { readFileSync, readdirSync, statSync } = await import('fs');
    const { join } = await import('path');

    const modulesDir = join(__dirname, '..', '..');
    const sources: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (entry.endsWith('.ts') && !entry.endsWith('.spec.ts')) {
          // Сам сервис достижений не считается: там методы объявлены.
          if (!full.includes(join('achievements', 'achievements.service.ts'))) {
            sources.push(readFileSync(full, 'utf8'));
          }
        }
      }
    };
    walk(modulesDir);

    const all = sources.join('\n');
    const methods = [
      'onEnrollment',
      'onHomeworkSubmitted',
      'onPerfectGrade',
      'onTrialCompleted',
      'onReferral',
    ];

    const orphans = methods.filter((m) => !all.includes(`.${m}(`));
    expect(orphans).toEqual([]);
  });
});
