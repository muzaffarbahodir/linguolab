import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { IsString } from 'class-validator';
import { Role } from '@prisma/client';

import { CertificatesService } from './certificates.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/strategies/jwt.strategy';

class IssueDto {
  @IsString() student_id!: string;
  @IsString() class_id!: string;
}

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  /** GET /certificates/my */
  @Get('my')
  my(@Req() req: Request) {
    const user = req.user as { sub: string };
    return this.certificates.myCertificates(user.sub);
  }

  /** POST /certificates/issue — учитель своего класса / менеджер+ выдаёт сертификат */
  @Post('issue')
  @Roles(Role.TEACHER, Role.MANAGER, Role.ADMIN, Role.SUPER_ADMIN)
  issue(@Body() dto: IssueDto, @CurrentUser() user: RequestUser) {
    return this.certificates.issue(dto.student_id, dto.class_id, user);
  }
}
