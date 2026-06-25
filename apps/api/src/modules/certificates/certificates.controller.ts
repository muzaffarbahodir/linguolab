import { Controller, Get, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import { IsString } from 'class-validator';

import { CertificatesService } from './certificates.service';

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

  /** POST /certificates/issue — менеджер выдаёт сертификат */
  @Post('issue')
  issue(@Body() dto: IssueDto) {
    return this.certificates.issue(dto.student_id, dto.class_id);
  }
}
