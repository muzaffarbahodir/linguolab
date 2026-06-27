import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

/** Генерируем UUID v4 нативно (Crypto API) */
function uuidv4(): string {
  return crypto.randomUUID();
}

export type PaymentProvider = 'PAYME' | 'CLICK' | 'UZUMBANK' | 'CASH';
export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'FAILED'
  | 'EXPIRED';

export interface Payment {
  id: string;
  amount_tiyin: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  class?: { title: string; level: string };
  paid_at: string | null;
  created_at: string;
}

export interface CheckoutResponse {
  payment_id: string;
  status: PaymentStatus;
  provider: PaymentProvider;
  amount_tiyin: string;
  redirect_url: string;
}

/**
 * Создать платёж и получить URL для оплаты.
 * idempotency_key передаёт вызывающий — стабильный на повтор (защита от дублей
 * при двойном клике). Если не передан — генерируем (fallback).
 */
export function useCheckout() {
  return useMutation({
    mutationFn: async (params: {
      provider: PaymentProvider;
      class_id: string;
      idempotency_key?: string;
      /** Для родителя — id ребёнка, за которого платят. */
      student_id?: string;
      /** Для очного пробного — id заявки, к которой привязать платёж (legacy). */
      trial_id?: string;
      /** Язык очного пробного — заявка создастся после оплаты. */
      offline_trial_language_id?: string;
    }) => {
      const { data } = await apiClient.post<CheckoutResponse>('/payments/checkout', {
        provider: params.provider,
        class_id: params.class_id,
        idempotency_key: params.idempotency_key ?? uuidv4(),
        ...(params.student_id ? { student_id: params.student_id } : {}),
        ...(params.trial_id ? { trial_id: params.trial_id } : {}),
        ...(params.offline_trial_language_id
          ? { offline_trial_language_id: params.offline_trial_language_id }
          : {}),
      });
      return data;
    },
  });
}

export interface ReceiptInfo {
  status: 'NONE' | 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'REFUNDED';
  receipt_url: string | null;
  fiscal_sign: string | null;
  fiscal_number: string | null;
}

/** Фискальный чек по платежу — тянем по кнопке (on-demand). */
export function useFetchReceipt() {
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { data } = await apiClient.get<ReceiptInfo>(`/payments/${paymentId}/receipt`);
      return data;
    },
  });
}

export interface PaymentDetail {
  id: string;
  amount_tiyin: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  created_at: string;
  class?: { title: string; level: string; language?: { flag_emoji: string } } | null;
}

/** Платёж студента по id (владелец) — для экрана чека наличной оплаты. */
export function usePaymentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['payment', id],
    enabled: !!id,
    queryFn: async () => (await apiClient.get<PaymentDetail>(`/payments/${id}`)).data,
  });
}

export interface AdminPaymentDetail {
  id: string;
  amount_tiyin: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  created_at: string;
  user: { first_name: string; last_name: string | null; telegram_username: string | null };
  class: { title: string; level: string } | null;
}

/** Платёж по id для менеджера (скан QR наличного чека). */
export function useAdminPaymentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'payment', id],
    enabled: !!id,
    retry: false,
    queryFn: async () => (await apiClient.get<AdminPaymentDetail>(`/payments/admin/${id}`)).data,
  });
}

/** История платежей студента */
export function useMyPayments() {
  return useQuery<Payment[]>({
    queryKey: ['payments', 'my'],
    queryFn: async () => {
      const { data } = await apiClient.get<Payment[]>('/payments/history');
      return data;
    },
  });
}

/** Последний незавершённый платёж (для возврата из чекаута) */
export function useLastPending() {
  return useQuery({
    queryKey: ['payments', 'last-pending'],
    queryFn: async () => {
      const { data } = await apiClient.get('/payments/last-pending');
      return data as (CheckoutResponse & { class?: { title: string } }) | null;
    },
  });
}
