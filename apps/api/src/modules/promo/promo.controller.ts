import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { PromoService, type UpsertPromoDto } from './promo.service';

@Controller('promo')
export class PromoController {
  constructor(private readonly promo: PromoService) {}

  /** POST /promo/validate — проверить промокод (студент). */
  @Post('validate')
  validate(@Body('code') code: string) {
    return this.promo.validate(code ?? '');
  }

  // ─── Admin (MANAGER+) ─────────────────────────────────────────────────────────

  /** GET /promo/admin — список промокодов. */
  @Get('admin')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  list() {
    return this.promo.list();
  }

  /** POST /promo — создать промокод. */
  @Post()
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  create(@Body() dto: UpsertPromoDto) {
    return this.promo.create(dto);
  }

  /** PATCH /promo/:id — обновить. */
  @Patch(':id')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpsertPromoDto) {
    return this.promo.update(id, dto);
  }

  /** DELETE /promo/:id — удалить. */
  @Delete(':id')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  remove(@Param('id') id: string) {
    return this.promo.remove(id);
  }
}
