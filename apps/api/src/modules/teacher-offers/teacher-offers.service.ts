import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CEFR, StudyFormat } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertOfferDto {
  language_id: string;
  level?: CEFR | null;
  format?: StudyFormat | null;
  price_uzs?: number;
  price_usd?: number;
  note?: string | null;
  is_active?: boolean;
}

/**
 * Офферы учителей — «готов учить предмет X» ещё до открытия группы.
 * Один оффер на пару (учитель, язык). Виден студентам на странице курса.
 */
@Injectable()
export class TeacherOffersService {
  constructor(private readonly prisma: PrismaService) {}

  private async teacherId(userId: string): Promise<string> {
    const t = await this.prisma.teacher.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });
    if (!t) throw new ForbiddenException('Teacher profile not found');
    return t.id;
  }

  /** POST /teacher-offers — создать/обновить оффер (upsert по teacher+language). */
  async upsert(userId: string, dto: UpsertOfferDto) {
    const teacher_id = await this.teacherId(userId);
    const data = {
      level: dto.level ?? null,
      format: dto.format ?? null,
      price_uzs: dto.price_uzs ?? 0,
      price_usd: dto.price_usd ?? 0,
      note: dto.note ?? null,
      is_active: dto.is_active ?? true,
    };
    return this.prisma.teacherOffer.upsert({
      where: { teacher_id_language_id: { teacher_id, language_id: dto.language_id } },
      create: { teacher_id, language_id: dto.language_id, ...data },
      update: data,
    });
  }

  /** GET /teacher-offers/my — офферы текущего учителя. */
  async findMy(userId: string) {
    const teacher_id = await this.teacherId(userId);
    return this.prisma.teacherOffer.findMany({
      where: { teacher_id },
      orderBy: { created_at: 'desc' },
      include: {
        language: { select: { id: true, name_ru: true, flag_emoji: true, color: true } },
      },
    });
  }

  /** DELETE /teacher-offers/:id — удалить свой оффер. */
  async remove(userId: string, id: string) {
    const teacher_id = await this.teacherId(userId);
    const offer = await this.prisma.teacherOffer.findUnique({
      where: { id },
      select: { teacher_id: true },
    });
    if (!offer || offer.teacher_id !== teacher_id) throw new NotFoundException('Offer not found');
    await this.prisma.teacherOffer.delete({ where: { id } });
    return { ok: true };
  }
}
