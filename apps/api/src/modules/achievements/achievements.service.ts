import { Injectable } from '@nestjs/common';
import { AchievementTrigger } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Разблокировать достижение если ещё не разблокировано */
  private async unlock(userId: string, trigger: AchievementTrigger): Promise<void> {
    const achievement = await this.prisma.achievement.findFirst({ where: { trigger } });
    if (!achievement) return;

    const exists = await this.prisma.userAchievement.findUnique({
      where: { user_id_achievement_id: { user_id: userId, achievement_id: achievement.id } },
    });
    if (exists) return;

    await this.prisma.userAchievement.create({
      data: { user_id: userId, achievement_id: achievement.id },
    });
  }

  /** Вызывается при записи в класс */
  async onEnrollment(userId: string): Promise<void> {
    await this.unlock(userId, AchievementTrigger.FIRST_ENROLLMENT);
  }

  /** Вызывается при сдаче ДЗ */
  async onHomeworkSubmitted(userId: string): Promise<void> {
    // Первое ДЗ
    await this.unlock(userId, AchievementTrigger.FIRST_HOMEWORK);

    // Подсчёт серий
    const count = await this.prisma.homeworkSubmission.count({
      where: { student_id: userId, status: { in: ['SUBMITTED', 'GRADED'] } },
    });
    if (count >= 5) await this.unlock(userId, AchievementTrigger.HOMEWORK_STREAK_5);
    if (count >= 10) await this.unlock(userId, AchievementTrigger.HOMEWORK_STREAK_10);
  }

  /** Вызывается при оценке 100 */
  async onPerfectGrade(userId: string): Promise<void> {
    await this.unlock(userId, AchievementTrigger.PERFECT_GRADE);
  }

  /** Вызывается при завершении пробного урока */
  async onTrialCompleted(userId: string): Promise<void> {
    await this.unlock(userId, AchievementTrigger.TRIAL_COMPLETED);
  }

  /** Вызывается при первом реферале */
  async onReferral(userId: string): Promise<void> {
    await this.unlock(userId, AchievementTrigger.REFERRAL_1);
  }

  /** Мои достижения */
  async myAchievements(userId: string) {
    const unlocked = await this.prisma.userAchievement.findMany({
      where: { user_id: userId },
      include: { achievement: true },
      orderBy: { unlocked_at: 'desc' },
    });

    const all = await this.prisma.achievement.findMany({ orderBy: { trigger: 'asc' } });

    const unlockedIds = new Set(unlocked.map((u) => u.achievement_id));

    return {
      unlocked: unlocked.map((u: (typeof unlocked)[number]) => ({
        ...u.achievement,
        unlocked_at: u.unlocked_at,
        is_unlocked: true,
      })),
      locked: all
        .filter((a: (typeof all)[number]) => !unlockedIds.has(a.id))
        .map((a: (typeof all)[number]) => ({ ...a, is_unlocked: false })),
    };
  }
}
