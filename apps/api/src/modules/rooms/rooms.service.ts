import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

/**
 * RoomsService — аудитории (кабинеты) очного центра.
 * CRUD для админа; выбор кабинета идёт при апруве класс-заявки
 * и через PATCH /classes/:id/room (конфликт-чек там же, в ClassesService).
 */
@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Список кабинетов + число живых групп в каждом. */
  findAll() {
    return this.prisma.room.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        capacity: true,
        is_active: true,
        _count: {
          select: {
            classes: {
              where: { status: { in: ['DRAFT', 'ENROLLMENT_OPEN', 'ACTIVE', 'EXAM'] } },
            },
          },
        },
      },
    });
  }

  async create(name: string, capacity?: number | null) {
    const trimmed = name.trim();
    const existing = await this.prisma.room.findUnique({ where: { name: trimmed } });
    if (existing) throw new ConflictException('Room with this name already exists');
    return this.prisma.room.create({
      data: { name: trimmed, capacity: capacity ?? null },
      select: { id: true, name: true, capacity: true, is_active: true },
    });
  }

  async update(id: string, data: { name?: string; capacity?: number | null; is_active?: boolean }) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    return this.prisma.room.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      },
      select: { id: true, name: true, capacity: true, is_active: true },
    });
  }
}
