import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Trial Lessons ────────────────────────────────────────────────────────────

export function useRequestTrial() {
  return useMutation({
    mutationFn: (data: { language_id: string; note?: string }) =>
      apiClient.post('/trial-lessons/request', data).then((r) => r.data),
  });
}

export function useMyTrials() {
  return useQuery({
    queryKey: ['trials', 'my'],
    queryFn: () =>
      apiClient
        .get<
          { id: string; status: string; language: { name_ru: string; flag_emoji: string } }[]
        >('/trial-lessons/my')
        .then((r) => r.data),
  });
}

// ─── Support Tickets ──────────────────────────────────────────────────────────

export function useCreateTicket() {
  return useMutation({
    mutationFn: (data: { subject: string; message: string }) =>
      apiClient.post('/support/tickets', data).then((r) => r.data),
  });
}

// ─── Referrals ────────────────────────────────────────────────────────────────

export interface MyReferral {
  code: string;
  used_count: number;
  created_at: string;
}

export function useMyReferral() {
  return useQuery({
    queryKey: ['referral', 'my'],
    queryFn: () => apiClient.get<MyReferral>('/referrals/my').then((r) => r.data),
  });
}
