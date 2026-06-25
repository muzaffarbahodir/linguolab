import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrialType = 'ONLINE' | 'OFFLINE';

export interface TrialRequest {
  id: string;
  type: TrialType;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  note?: string | null;
  class_id?: string | null;
  created_at: string;
  language: { id: string; name_ru: string; flag_emoji: string; color?: string | null };
}

/** Ответ создания заявки: для очного (OFFLINE) — needs_payment + цена. */
export interface TrialRequestResult extends TrialRequest {
  needs_payment: boolean;
  price_uzs?: number;
}

export interface TrialRequestManager extends TrialRequest {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    telegram_username?: string | null;
  };
}

// ── Student hooks ─────────────────────────────────────────────────────────────

export function useMyTrials() {
  return useQuery<TrialRequest[]>({
    queryKey: ['trial-lessons', 'my'],
    queryFn: () => apiClient.get<TrialRequest[]>('/trial-lessons/my').then((r) => r.data),
  });
}

export function useRequestTrial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { language_id: string; type: TrialType; note?: string }) =>
      apiClient.post<TrialRequestResult>('/trial-lessons/request', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trial-lessons', 'my'] });
    },
  });
}

// ── Manager hooks ─────────────────────────────────────────────────────────────

export function useAllTrials(status?: string) {
  return useQuery<TrialRequestManager[]>({
    queryKey: ['trial-lessons', 'all', status ?? 'ALL'],
    queryFn: () =>
      apiClient
        .get<TrialRequestManager[]>('/trial-lessons', { params: status ? { status } : {} })
        .then((r) => r.data),
  });
}

export function useUpdateTrialStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'CONFIRMED' | 'CANCELLED' }) =>
      apiClient
        .patch<{ id: string; status: string }>(`/trial-lessons/${id}/status`, { status })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trial-lessons'] });
    },
  });
}
