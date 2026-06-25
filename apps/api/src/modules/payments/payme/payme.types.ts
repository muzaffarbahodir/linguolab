/** Payme JSON-RPC методы */
export type PaymeMethod =
  | 'CheckPerformTransaction'
  | 'CreateTransaction'
  | 'PerformTransaction'
  | 'CancelTransaction'
  | 'CheckTransaction'
  | 'GetStatement';

export interface PaymeRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: PaymeMethod;
  params: Record<string, unknown>;
}

export interface PaymeRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: Record<string, unknown>;
  error?: { code: number; message: { ru: string; uz: string; en: string }; data?: unknown };
}

/** Payme transaction state codes */
export const PaymeState = {
  PENDING: 1, // создана, не оплачена
  COMPLETED: 2, // оплачена
  CANCELLED: -1, // отменена до оплаты
  CANCELLED_AFTER_COMPLETE: -2, // отменена после оплаты (refund)
} as const;

/** Причины отмены */
export const PaymeCancelReason = {
  RECEIVER_NOT_FOUND: 1, // получатель не найден
  PROCESSING_ERROR: 2, // ошибка обработки
  TRANSACTION_EXPIRED: 3, // истёк срок оплаты
  CANCELLED_BY_USER: 4, // отменено пользователем
  INSUFFICIENT_FUNDS: 5, // недостаточно средств
  REFUND: 10, // возврат
} as const;

/** Коды ошибок Payme */
export const PaymeError = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Payme-специфичные
  INSUFFICIENT_PRIVILEGE: -32504,
  INVALID_AMOUNT: -31001,
  ORDER_NOT_FOUND: -31050,
  ORDER_ALREADY_PAID: -31051,
  TRANSACTION_NOT_FOUND: -31003,
  UNABLE_TO_CANCEL: -31007,
  UNABLE_TO_PERFORM: -31008,
} as const;

export function paymeError(
  id: number | string,
  code: number,
  message: string,
  data?: unknown,
): PaymeRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message: { ru: message, uz: message, en: message },
      ...(data !== undefined ? { data } : {}),
    },
  };
}

export function paymeResult(
  id: number | string,
  result: Record<string, unknown>,
): PaymeRpcResponse {
  return { jsonrpc: '2.0', id, result };
}
