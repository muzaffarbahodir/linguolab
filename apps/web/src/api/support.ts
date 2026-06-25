import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  created_at: string;
}

export interface SupportTicketManager extends SupportTicket {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    telegram_username?: string | null;
  };
}

// ── Student hooks ─────────────────────────────────────────────────────────────

export function useMyTickets() {
  return useQuery<SupportTicket[]>({
    queryKey: ['support', 'my'],
    queryFn: () => apiClient.get<SupportTicket[]>('/support/tickets/my').then((r) => r.data),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject: string; message: string }) =>
      apiClient.post<SupportTicket>('/support/tickets', data).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support', 'my'] });
    },
  });
}

// ── Manager hooks ─────────────────────────────────────────────────────────────

export function useAllTickets(status?: string) {
  return useQuery<SupportTicketManager[]>({
    queryKey: ['support', 'all', status ?? 'ALL'],
    queryFn: () =>
      apiClient
        .get<SupportTicketManager[]>('/support/tickets', { params: status ? { status } : {} })
        .then((r) => r.data),
  });
}

export function useUpdateTicketStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      apiClient
        .patch<{ id: string; status: TicketStatus }>(`/support/tickets/${id}/status`, { status })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['support'] });
    },
  });
}
