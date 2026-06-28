import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertPromoDto {
  code?: string;
  discount_percent?: number;
  max_uses?: number | null;
  valid_until?: string | null;
  is_active?: boolean;
}

export type PromoValidation =
  | { valid: true; code: string; discount_percent: number }
  | { valid: false; discount_percent: 0; reason: 'not_found' | 'expired' | 'used_up' };

@Injectable()
export class PromoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Проверяет промокод без списания. */
  async validate(codeRaw: string): Promise<PromoValidation> {
    const code = codeRaw.trim().toUpperCase();
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    if (!promo || !promo.is_active) {
      return { valid: false, discount_percent: 0, reason: 'not_found' };
    }
    if (promo.valid_until && promo.valid_until < new Date()) {
      return { valid: false, discount_percent: 0, reason: 'expired' };
    }
    if (promo.max_uses != null && promo.used_count >= promo.max_uses) {
      return { valid: false, discount_percent: 0, reason: 'used_up' };
    }
    return { valid: true, code, discount_percent: promo.discount_percent };
  }

  /** Проверяет и списывает одно использование. Возвращает null, если код невалиден. */
  async consume(codeRaw: string): Promise<{ code: string; discount_percent: number } | null> {
    const v = await this.validate(codeRaw);
    if (!v.valid) return null;
    await this.prisma.promoCode.updateMany({
      where: { code: v.code, is_active: true },
      data: { used_count: { increment: 1 } },
    });
    return { code: v.code, discount_percent: v.discount_percent };
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  list() {
    return this.prisma.promoCode.findMany({ orderBy: { created_at: 'desc' } });
  }

  create(dto: UpsertPromoDto) {
    return this.prisma.promoCode.create({
      data: {
        code: (dto.code ?? '').trim().toUpperCase(),
        discount_percent: this.clampPct(dto.discount_percent ?? 0),
        max_uses: dto.max_uses ?? null,
        valid_until: dto.valid_until ? new Date(dto.valid_until) : null,
        is_active: dto.is_active ?? true,
      },
    });
  }

  async update(id: string, dto: UpsertPromoDto) {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promo not found');
    return this.prisma.promoCode.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
        ...(dto.discount_percent !== undefined
          ? { discount_percent: this.clampPct(dto.discount_percent) }
          : {}),
        ...(dto.max_uses !== undefined ? { max_uses: dto.max_uses } : {}),
        ...(dto.valid_until !== undefined
          ? { valid_until: dto.valid_until ? new Date(dto.valid_until) : null }
          : {}),
        ...(dto.is_active !== undefined ? { is_active: dto.is_active } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promo not found');
    await this.prisma.promoCode.delete({ where: { id } });
    return { ok: true };
  }

  private clampPct(n: number): number {
    return Math.min(Math.max(Math.round(n), 1), 100);
  }
}
