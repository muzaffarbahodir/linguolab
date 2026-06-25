import { Controller, Post, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { IsString } from 'class-validator';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import path from 'path';

import { StorageService } from './storage.service';
import { PresignDto } from './dto/presign.dto';

/** DTO для подтверждения загрузки */
class ConfirmUploadDto {
  /** R2 object key полученный из presigned-upload */
  @IsString() key!: string;
}

@Controller('storage')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /**
   * POST /storage/presigned-upload
   * Генерирует presigned PUT URL (TTL 15 мин).
   * Клиент делает PUT напрямую в R2, затем вызывает POST /storage/confirm.
   */
  @Post('presigned-upload')
  async presignedUpload(@Body() dto: PresignDto, @Req() req: Request) {
    const user = req.user as { sub: string };
    const ext = path.extname(dto.filename).toLowerCase();
    const key = `uploads/${user.sub}/${randomUUID()}${ext}`;
    const uploadUrl = await this.storage.presignedUpload(key, dto.contentType);
    const publicUrl = this.storage.publicUrl(key);
    return { key, uploadUrl, publicUrl };
  }

  /**
   * POST /storage/confirm
   * Вызывается после успешного PUT в R2.
   * Проверяет что объект существует и возвращает публичный URL.
   * Используется как дополнительная валидация — основная логика
   * подтверждения происходит в domain-эндпоинтах (homework/submit и т.п.)
   */
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(@Body() dto: ConfirmUploadDto, @Req() req: Request) {
    const user = req.user as { sub: string };
    // Проверяем что key принадлежит этому пользователю
    if (!dto.key.startsWith(`uploads/${user.sub}/`)) {
      return { ok: false, error: 'Forbidden key' };
    }
    const publicUrl = this.storage.publicUrl(dto.key);
    return { ok: true, key: dto.key, publicUrl };
  }
}
