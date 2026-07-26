import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Участник конференции из отчёта Zoom. */
export interface ZoomParticipant {
  /** Отображаемое имя, под которым человек вошёл. */
  name: string;
  /** Сколько минут суммарно провёл в конференции. */
  minutes: number;
}

export interface CreatedMeeting {
  meeting_id: string;
  join_url: string;
  start_url: string;
}

/**
 * ZoomService — тонкий клиент Zoom REST API на Server-to-Server OAuth.
 *
 * Если учётные данные не заданы, сервис остаётся выключенным и все методы
 * возвращают null: это ровно текущее состояние школы (Zoom не подключён), и
 * при таком раскладе система должна работать как раньше — со ссылкой,
 * которую преподаватель вписывает руками.
 *
 * Токен S2S живёт час; держим его в памяти и обновляем за минуту до истечения,
 * чтобы не ходить за ним на каждый запрос.
 */
@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);

  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  get isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('ZOOM_ACCOUNT_ID') &&
      this.config.get<string>('ZOOM_CLIENT_ID') &&
      this.config.get<string>('ZOOM_CLIENT_SECRET'),
    );
  }

  /** Секрет для проверки подписи вебхука. Пустой = вебхуки принимать нельзя. */
  get webhookSecret(): string {
    return this.config.get<string>('ZOOM_WEBHOOK_SECRET_TOKEN') ?? '';
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────

  private async accessToken(): Promise<string | null> {
    if (!this.isConfigured) return null;
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;

    const id = this.config.get<string>('ZOOM_CLIENT_ID')!;
    const secret = this.config.get<string>('ZOOM_CLIENT_SECRET')!;
    const account = this.config.get<string>('ZOOM_ACCOUNT_ID')!;
    const basic = Buffer.from(`${id}:${secret}`).toString('base64');

    try {
      const res = await fetch(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${account}`,
        { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
      );
      if (!res.ok) {
        this.logger.error(`Zoom OAuth failed: ${res.status} ${await res.text()}`);
        return null;
      }
      const body = (await res.json()) as { access_token: string; expires_in: number };
      this.token = body.access_token;
      // Минута запаса, чтобы не попасть на истечение в момент запроса.
      this.tokenExpiresAt = Date.now() + (body.expires_in - 60) * 1000;
      return this.token;
    } catch (err) {
      this.logger.error(`Zoom OAuth error: ${String(err)}`);
      return null;
    }
  }

  private async api<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    const token = await this.accessToken();
    if (!token) return null;

    try {
      const res = await fetch(`https://api.zoom.us/v2${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        this.logger.warn(`Zoom ${path} -> ${res.status}: ${await res.text()}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (err) {
      this.logger.warn(`Zoom ${path} failed: ${String(err)}`);
      return null;
    }
  }

  // ─── Meetings ───────────────────────────────────────────────────────────────

  /**
   * Создаёт конференцию под конкретное занятие.
   * null означает «не получилось» — вызывающий код обязан продолжить работать
   * без конференции, а не падать: урок важнее ссылки на него.
   */
  async createMeeting(opts: {
    topic: string;
    startAt: Date;
    durationMin: number;
    timezone?: string;
  }): Promise<CreatedMeeting | null> {
    const body = await this.api<{ id: number; join_url: string; start_url: string }>(
      '/users/me/meetings',
      {
        method: 'POST',
        body: JSON.stringify({
          topic: opts.topic,
          type: 2, // запланированная
          start_time: opts.startAt.toISOString(),
          duration: opts.durationMin,
          timezone: opts.timezone ?? 'Asia/Tashkent',
          settings: {
            join_before_host: false,
            // Зал ожидания: посторонний по переславшейся ссылке не окажется
            // на занятии сам собой.
            waiting_room: true,
            auto_recording: 'cloud',
            participant_video: true,
          },
        }),
      },
    );
    if (!body) return null;

    return {
      meeting_id: String(body.id),
      join_url: body.join_url,
      start_url: body.start_url,
    };
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    await this.api(`/meetings/${meetingId}`, { method: 'DELETE' });
  }

  /**
   * Отчёт об участниках завершённой конференции.
   *
   * Один человек может входить и выходить несколько раз — Zoom вернёт по
   * записи на каждый вход. Схлопываем по имени и суммируем минуты, иначе
   * короткий обрыв связи выглядел бы как два разных студента.
   */
  async getParticipants(meetingId: string): Promise<ZoomParticipant[] | null> {
    const body = await this.api<{
      participants: { name: string; duration: number }[];
    }>(`/report/meetings/${meetingId}/participants?page_size=300`);
    if (!body) return null;

    const byName = new Map<string, number>();
    for (const p of body.participants ?? []) {
      const name = (p.name ?? '').trim();
      if (!name) continue;
      // duration приходит в секундах.
      byName.set(name, (byName.get(name) ?? 0) + Math.round((p.duration ?? 0) / 60));
    }
    return [...byName.entries()].map(([name, minutes]) => ({ name, minutes }));
  }
}
