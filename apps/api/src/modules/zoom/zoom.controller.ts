import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';

import { Public } from '../auth/decorators/public.decorator';
import { ZoomAttendanceService } from './zoom-attendance.service';
import { ZoomService } from './zoom.service';

/** Полезная часть вебхука Zoom — берём только то, что используем. */
interface ZoomWebhookBody {
  event?: string;
  payload?: {
    plainToken?: string;
    object?: {
      id?: string | number;
      recording_files?: { play_url?: string; download_url?: string }[];
      share_url?: string;
    };
  };
}

/**
 * Вебхуки Zoom.
 *
 * Эндпоинт публичный — Zoom не умеет присылать наш JWT, — поэтому единственная
 * защита здесь подпись. Без секрета запросы не принимаются вообще: принимать
 * неподписанные означало бы позволить любому желающему отмечать посещаемость
 * чужих занятий.
 */
@Controller('zoom')
export class ZoomController {
  private readonly logger = new Logger(ZoomController.name);

  constructor(
    private readonly zoom: ZoomService,
    private readonly attendance: ZoomAttendanceService,
  ) {}

  @Post('webhook')
  @Public()
  @HttpCode(200)
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: ZoomWebhookBody,
    @Headers('x-zm-signature') signature?: string,
    @Headers('x-zm-request-timestamp') timestamp?: string,
  ) {
    const secret = this.zoom.webhookSecret;
    if (!secret) {
      this.logger.error('ZOOM_WEBHOOK_SECRET_TOKEN not set — rejecting webhook');
      throw new UnauthorizedException('Webhook not configured');
    }

    // Подтверждение владения эндпоинтом при подключении вебхука в консоли Zoom.
    if (body.event === 'endpoint.url_validation') {
      const plainToken = body.payload?.plainToken;
      if (!plainToken) throw new BadRequestException('plainToken missing');
      return {
        plainToken,
        encryptedToken: createHmac('sha256', secret).update(plainToken).digest('hex'),
      };
    }

    this.assertSignature(req.rawBody, signature, timestamp, secret);

    const meetingId = body.payload?.object?.id;
    if (meetingId === undefined) return { ok: true };
    const id = String(meetingId);

    switch (body.event) {
      case 'meeting.ended':
        // Отчёт об участниках Zoom готовит не мгновенно — не ждём ответа,
        // иначе вебхук словит таймаут и Zoom начнёт слать повторы.
        void this.attendance.applyForMeeting(id);
        break;

      case 'recording.completed': {
        const files = body.payload?.object?.recording_files ?? [];
        const url = body.payload?.object?.share_url ?? files[0]?.play_url;
        if (url) void this.attendance.saveRecording(id, url);
        break;
      }

      default:
        // Остальные события подписаны, но нам не нужны.
        break;
    }

    return { ok: true };
  }

  /**
   * Подпись Zoom: v0=HMAC_SHA256(secret, "v0:" + timestamp + ":" + тело).
   * Тело берём сырым — пересобранный из объекта JSON даёт другую строку.
   */
  private assertSignature(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    timestamp: string | undefined,
    secret: string,
  ): void {
    if (!rawBody || !signature || !timestamp) {
      throw new UnauthorizedException('Missing signature');
    }

    // Отсекаем повтор старого перехваченного запроса.
    const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSec) || ageSec > 300) {
      throw new UnauthorizedException('Stale webhook timestamp');
    }

    const expected =
      'v0=' +
      createHmac('sha256', secret)
        .update(`v0:${timestamp}:${rawBody.toString('utf8')}`)
        .digest('hex');

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Bad signature');
    }
  }
}
