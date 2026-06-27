import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { TeacherOffersService, type UpsertOfferDto } from './teacher-offers.service';

@Controller('teacher-offers')
export class TeacherOffersController {
  constructor(private readonly service: TeacherOffersService) {}

  /** POST /teacher-offers — учитель создаёт/обновляет оффер на предмет. */
  @Post()
  @Roles(Role.TEACHER)
  upsert(@CurrentUser() user: RequestUser, @Body() dto: UpsertOfferDto) {
    return this.service.upsert(user.id, dto);
  }

  /** GET /teacher-offers/my — офферы учителя. */
  @Get('my')
  @Roles(Role.TEACHER)
  findMy(@CurrentUser() user: RequestUser) {
    return this.service.findMy(user.id);
  }

  /** DELETE /teacher-offers/:id — удалить свой оффер. */
  @Delete(':id')
  @Roles(Role.TEACHER)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user.id, id);
  }
}
