import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/** Генерирует короткий уникальный код (6 символов, base36) */
function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /referrals/my
   * Возвращает реферальный код пользователя.
   * Если кода нет — создаёт новый.
   */
  async getOrCreate(userId: string) {
    const existing = await this.prisma.referral.findUnique({
      where: { referrer_id: userId },
      select: { code: true, used_count: true, bonus_days_granted: true, created_at: true },
    });
    if (existing) return existing;

    let code = generateCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const conflict = await this.prisma.referral.findUnique({ where: { code } });
      if (!conflict) break;
      code = generateCode();
    }

    return this.prisma.referral.create({
      data: { referrer_id: userId, code },
      select: { code: true, used_count: true, bonus_days_granted: true, created_at: true },
    });
  }

  /**
   * POST /referrals/redeem
   * Студент активирует чужой код. Один раз — нельзя активировать свой или повторно.
   */
  async redeem(userId: string, code: string) {
    const referral = await this.prisma.referral.findUnique({ where: { code } });
    if (!referral) throw new BadRequestException('Реферальный код не найден');
    if (referral.referrer_id === userId) {
      throw new BadRequestException('Нельзя использовать собственный код');
    }
    if (referral.invitee_id) {
      throw new BadRequestException('Этот код уже был использован');
    }

    // Проверяем, не использовал ли этот пользователь уже какой-то код
    const alreadyUsed = await this.prisma.referral.findFirst({
      where: { invitee_id: userId },
    });
    if (alreadyUsed) throw new BadRequestException('Вы уже использовали реферальный код');

    await this.prisma.referral.update({
      where: { id: referral.id },
      data: {
        invitee_id: userId,
        redeemed_at: new Date(),
        used_count: { increment: 1 },
      },
    });

    return { success: true, message: 'Код активирован! Менеджер начислит бонус.' };
  }

  /** GET /referrals/admin/stats — аналитика для менеджера/админа */
  async adminStats() {
    const [total, redeemed, topReferrers] = await Promise.all([
      this.prisma.referral.count(),
      this.prisma.referral.count({ where: { invitee_id: { not: null } } }),
      this.prisma.referral.findMany({
        where: { used_count: { gt: 0 } },
        orderBy: { used_count: 'desc' },
        take: 10,
        select: {
          code: true,
          used_count: true,
          bonus_days_granted: true,
          created_at: true,
          referrer: { select: { first_name: true, last_name: true, telegram_username: true } },
        },
      }),
    ]);

    return {
      total,
      redeemed,
      conversion_pct: total > 0 ? Math.round((redeemed / total) * 100) : 0,
      top_referrers: topReferrers,
    };
  }
}
