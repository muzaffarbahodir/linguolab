import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/** 1 балл = N сум при трате (скидка). */
export const POINT_VALUE_UZS = 500;
/** Кэшбэк за оплату: начисляем баллы на эквивалент EARN_PERCENT% от суммы. */
const EARN_PERCENT = 5;
/** Бонус рефереру за первую оплату приглашённого. */
const REFERRAL_BONUS = 5;

export type PointTxType =
  | 'earn_purchase'
  | 'earn_referral'
  | 'earn_bonus'
  | 'spend_payment'
  | 'refund';

const LEVELS: { min: number; key: string }[] = [
  { min: 60, key: 'platinum' },
  { min: 30, key: 'gold' },
  { min: 10, key: 'silver' },
  { min: 0, key: 'bronze' },
];

function levelFor(totalEarned: number): { level: string; next_at: number | null } {
  const lvl = LEVELS.find((l) => totalEarned >= l.min) ?? LEVELS[LEVELS.length - 1]!;
  const next = [10, 30, 60].find((t) => totalEarned < t) ?? null;
  return { level: lvl.key, next_at: next };
}

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Начислить (+) или списать (−) баллы + запись в реестр. total_earned растёт только на начислениях. */
  async addPoints(
    userId: string,
    amount: number,
    type: PointTxType,
    description: string,
    paymentId?: string | null,
  ): Promise<void> {
    if (amount === 0) return;
    await this.prisma.$transaction([
      this.prisma.pointTransaction.create({
        data: { user_id: userId, amount, type, description, payment_id: paymentId ?? null },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          points: { increment: amount },
          ...(amount > 0 ? { total_earned_points: { increment: amount } } : {}),
        },
      }),
    ]);
  }

  /**
   * Кэшбэк за оплату курса + реферальный бонус (1 раз, при первой оплате приглашённого).
   * amountTiyin — payment.amount_tiyin (тийины = сум×100).
   */
  async awardForPayment(userId: string, amountTiyin: number, paymentId: string): Promise<void> {
    const amountUzs = amountTiyin / 100;
    const earned = Math.floor((amountUzs * EARN_PERCENT) / 100 / POINT_VALUE_UZS);
    if (earned > 0) {
      await this.addPoints(userId, earned, 'earn_purchase', 'Кэшбэк за оплату курса', paymentId);
    }
    await this.maybeReferralBonus(userId, paymentId);
  }

  /**
   * Сколько баллов реально можно списать на заказ: не больше баланса и не больше,
   * чем покрывает сумму заказа. Возвращает баллы + скидку в сумах.
   */
  async quoteRedeem(
    userId: string,
    orderUzs: number,
    requested: number,
  ): Promise<{ points: number; discount_uzs: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    const balance = user?.points ?? 0;
    const maxByOrder = Math.floor(orderUzs / POINT_VALUE_UZS);
    const points = Math.max(0, Math.min(Math.round(requested), balance, maxByOrder));
    return { points, discount_uzs: points * POINT_VALUE_UZS };
  }

  /** Списать баллы за оплату (с проверкой баланса). */
  async spend(userId: string, points: number, paymentId: string): Promise<void> {
    if (points <= 0) return;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { points: true },
    });
    if (!user || user.points < points) {
      throw new BadRequestException('Недостаточно баллов');
    }
    await this.addPoints(userId, -points, 'spend_payment', `Оплата баллами: −${points}`, paymentId);
  }

  private async maybeReferralBonus(inviteeId: string, paymentId: string): Promise<void> {
    const ref = await this.prisma.referral.findFirst({
      where: { invitee_id: inviteeId, points_granted: false },
      select: { id: true, referrer_id: true },
    });
    if (!ref) return;
    await this.prisma.referral.update({ where: { id: ref.id }, data: { points_granted: true } });
    await this.addPoints(
      ref.referrer_id,
      REFERRAL_BONUS,
      'earn_referral',
      'Бонус за приглашённого друга',
      paymentId,
    );
  }

  async getMyPoints(userId: string) {
    const [user, txs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { points: true, total_earned_points: true },
      }),
      this.prisma.pointTransaction.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        take: 50,
        select: { id: true, amount: true, type: true, description: true, created_at: true },
      }),
    ]);
    const totalEarned = user?.total_earned_points ?? 0;
    const lvl = levelFor(totalEarned);
    return {
      points: user?.points ?? 0,
      total_earned_points: totalEarned,
      level: lvl.level,
      next_level_points: lvl.next_at,
      point_value_uzs: POINT_VALUE_UZS,
      transactions: txs,
    };
  }

  async getLeaderboard(currentUserId: string) {
    const top = await this.prisma.user.findMany({
      where: { total_earned_points: { gt: 0 } },
      orderBy: { total_earned_points: 'desc' },
      take: 20,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        avatar_url: true,
        total_earned_points: true,
      },
    });
    return top.map((u, i) => ({
      rank: i + 1,
      name: `${u.first_name}${u.last_name ? ' ' + u.last_name[0] + '.' : ''}`,
      avatar_url: u.avatar_url,
      total_earned_points: u.total_earned_points,
      level: levelFor(u.total_earned_points).level,
      is_me: u.id === currentUserId,
    }));
  }
}
