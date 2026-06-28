import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { Role, EnrollmentStatus } from '@prisma/client';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';
import { EnrollmentsService } from './enrollments.service';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  /**
   * GET /enrollments/my — записи текущего студента (ACTIVE/PENDING).
   */
  @Get('my')
  findMy(@CurrentUser() user: RequestUser) {
    return this.enrollmentsService.findMy(user.id);
  }

  /**
   * GET /enrollments/transfer/my — мои запросы на перевод (студент).
   */
  @Get('transfer/my')
  findMyTransfers(@CurrentUser() user: RequestUser) {
    return this.enrollmentsService.findMyTransfers(user.id);
  }

  /** GET /enrollments/:id/journey — путь обучения студента в классе. */
  @Get(':id/journey')
  getJourney(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.enrollmentsService.getJourney(id, user.id);
  }

  /**
   * GET /enrollments/transfer — все запросы (менеджер). ?status=PENDING|APPROVED|REJECTED|CANCELLED
   */
  @Get('transfer')
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  findAllTransfers(@Query('status') status?: string) {
    return this.enrollmentsService.findAllTransfers(status);
  }

  /**
   * POST /enrollments/transfer — студент запрашивает перевод.
   * Body: { from_class_id, to_class_id, reason? }
   */
  @Post('transfer')
  @Roles(Role.STUDENT)
  requestTransfer(
    @CurrentUser() user: RequestUser,
    @Body('from_class_id') fromClassId: string,
    @Body('to_class_id') toClassId: string,
    @Body('reason') reason?: string,
  ) {
    if (!fromClassId || !toClassId) {
      throw new BadRequestException('from_class_id and to_class_id are required');
    }
    if (fromClassId === toClassId) {
      throw new BadRequestException('from_class_id and to_class_id must differ');
    }
    return this.enrollmentsService.requestTransfer(user.id, fromClassId, toClassId, reason);
  }

  /**
   * PATCH /enrollments/transfer/:id/cancel — студент отменяет запрос.
   */
  @Patch('transfer/:id/cancel')
  @HttpCode(200)
  cancelTransfer(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.enrollmentsService.cancelTransfer(id, user.id);
  }

  /**
   * PATCH /enrollments/transfer/:id/approve — менеджер одобряет.
   * Body: { admin_note? }
   */
  @Patch('transfer/:id/approve')
  @HttpCode(200)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  approveTransfer(@Param('id') id: string, @Body('admin_note') adminNote?: string) {
    return this.enrollmentsService.approveTransfer(id, adminNote);
  }

  /**
   * PATCH /enrollments/transfer/:id/reject — менеджер отклоняет.
   * Body: { admin_note? }
   */
  @Patch('transfer/:id/reject')
  @HttpCode(200)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  rejectTransfer(@Param('id') id: string, @Body('admin_note') adminNote?: string) {
    return this.enrollmentsService.rejectTransfer(id, adminNote);
  }

  /**
   * GET /enrollments — все записи для менеджера. ?status=PENDING|ACTIVE|DROPPED
   */
  @Get()
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  findAll(@Query('status') status?: string) {
    const validStatuses: EnrollmentStatus[] = ['PENDING', 'ACTIVE', 'DROPPED'];
    const parsed = status as EnrollmentStatus | undefined;
    if (status && !validStatuses.includes(parsed!)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }
    return this.enrollmentsService.findAll(parsed);
  }

  /**
   * PATCH /enrollments/:id/status — менеджер одобряет или отклоняет запись.
   * Body: { status: 'ACTIVE' | 'DROPPED' }
   */
  @Patch(':id/status')
  @HttpCode(200)
  @Roles(Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  updateStatus(@Param('id') id: string, @Body('status') status: 'ACTIVE' | 'DROPPED') {
    if (!['ACTIVE', 'DROPPED'].includes(status)) {
      throw new BadRequestException('status must be ACTIVE or DROPPED');
    }
    return this.enrollmentsService.updateStatus(id, status);
  }
}
