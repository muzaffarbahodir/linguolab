import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SoliqAuthRequest, SoliqAuthResponse } from './soliq.types';

/**
 * SoliqAuthService — управляет Bearer-токеном для Soliq OFD API.
 *
 * Стратегия:
 *  - Токен кэшируется в памяти с timestamp экспирации.
 *  - getToken() возвращает валидный токен; если истёк — обновляет автоматически.
 *  - forceRefresh() вызывается из SoliqClient при получении 401 (expired ahead of schedule).
 *  - В sandbox-режиме (SOLIQ_USE_SANDBOX=true) и без SOLIQ_CLIENT_SECRET
 *    возвращается фиктивный токен "sandbox-token" (реальных запросов нет).
 */
@Injectable()
export class SoliqAuthService {
  private readonly logger = new Logger(SoliqAuthService.name);

  private cachedToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  // Обновляем за 60 секунд до истечения (буфер)
  private readonly EXPIRY_BUFFER_MS = 60_000;

  constructor(private readonly config: ConfigService) {}

  /** Возвращает валидный Bearer-токен (обновляет если нужно) */
  async getToken(): Promise<string> {
    if (this.isSandboxWithoutCreds()) {
      return 'sandbox-token';
    }

    if (this.cachedToken && this.tokenExpiresAt) {
      const validUntil = this.tokenExpiresAt.getTime() - this.EXPIRY_BUFFER_MS;
      if (Date.now() < validUntil) {
        return this.cachedToken;
      }
    }

    return this.refresh();
  }

  /** Форсированное обновление токена (вызывается при 401 от API) */
  async forceRefresh(): Promise<string> {
    this.cachedToken = null;
    this.tokenExpiresAt = null;
    return this.refresh();
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async refresh(): Promise<string> {
    const baseUrl = this.getBaseUrl();
    const clientId = this.config.get<string>('SOLIQ_CLIENT_ID') ?? '';
    const clientSecret = this.config.get<string>('SOLIQ_CLIENT_SECRET') ?? '';

    const body: SoliqAuthRequest = { clientId, clientSecret };

    this.logger.debug(`Refreshing Soliq token from ${baseUrl}/api/auth/login`);

    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Soliq auth failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as SoliqAuthResponse;

    this.cachedToken = data.accessToken;
    this.tokenExpiresAt = new Date(data.expiresAt);

    this.logger.debug(`Soliq token refreshed, expires at ${data.expiresAt}`);

    return this.cachedToken;
  }

  /** Sandbox без реальных credentials — не делаем HTTP-вызовов */
  isSandboxWithoutCreds(): boolean {
    const useSandbox = this.config.get<string>('SOLIQ_USE_SANDBOX') === 'true';
    const hasSecret = !!this.config.get<string>('SOLIQ_CLIENT_SECRET');
    return useSandbox && !hasSecret;
  }

  getBaseUrl(): string {
    const useSandbox = this.config.get<string>('SOLIQ_USE_SANDBOX') === 'true';
    return useSandbox
      ? (this.config.get<string>('SOLIQ_SANDBOX_URL') ?? 'https://ofd-test.soliq.uz')
      : (this.config.get<string>('SOLIQ_API_URL') ?? 'https://ofd.soliq.uz');
  }
}
