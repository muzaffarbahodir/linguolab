import { Injectable, Logger } from '@nestjs/common';
import { SoliqAuthService } from './soliq-auth.service';
import { SoliqSendReceiptRequest, SoliqSendReceiptResponse } from './soliq.types';

/**
 * SoliqClient — HTTP-клиент для Soliq OFD API.
 *
 * Особенности:
 *  - Автоматически подставляет Bearer-токен в заголовок.
 *  - При 401 форсирует обновление токена и повторяет запрос 1 раз.
 *  - В sandbox-режиме без credentials возвращает stub-ответ (не делает HTTP).
 */
@Injectable()
export class SoliqClient {
  private readonly logger = new Logger(SoliqClient.name);

  constructor(private readonly auth: SoliqAuthService) {}

  /**
   * Отправить фискальный чек в ОФД.
   *
   * @throws Error если Soliq вернул ошибку (статус != 2xx или success=false)
   */
  async sendReceipt(req: SoliqSendReceiptRequest): Promise<SoliqSendReceiptResponse> {
    // Sandbox без реальных credentials — возвращаем stub
    if (this.auth.isSandboxWithoutCreds()) {
      this.logger.warn(
        `[SANDBOX STUB] sendReceipt terminalId=${req.terminalId} ` +
          `type=${req.receiptType} amount=${req.totalAmount}`,
      );
      return {
        success: true,
        receiptId: `sandbox-${Date.now()}`,
        fiscalSign: 'SANDBOX_FISCAL_SIGN',
        fiscalNumber: `SB-${Date.now()}`,
        receiptUrl: null!,
      };
    }

    return this.callWithRetry(req);
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async callWithRetry(
    req: SoliqSendReceiptRequest,
    isRetry = false,
  ): Promise<SoliqSendReceiptResponse> {
    const token = isRetry ? await this.auth.forceRefresh() : await this.auth.getToken();
    const baseUrl = this.auth.getBaseUrl();
    const url = `${baseUrl}/api/v1/fiscal-receipts`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(req),
    });

    // 401 — токен истёк раньше времени → обновляем и повторяем
    if (res.status === 401 && !isRetry) {
      this.logger.warn('Soliq 401 — refreshing token and retrying');
      return this.callWithRetry(req, true);
    }

    const body = (await res.json()) as SoliqSendReceiptResponse;

    if (!res.ok || !body.success) {
      throw new Error(
        `Soliq sendReceipt error: HTTP ${res.status} — ` +
          `${body.errorCode ?? 'unknown'}: ${body.errorMessage ?? 'no message'}`,
      );
    }

    this.logger.log(`Soliq receipt sent: ${body.receiptId} sign=${body.fiscalSign}`);

    return body;
  }
}
