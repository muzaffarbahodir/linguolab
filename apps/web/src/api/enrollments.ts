import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface MyEnrollment {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'DROPPED';
  enrolled_at: string;
  /** До какой даты оплачено (помесячная оплата). null = ещё не оплачивалось. */
  paid_until: string | null;
  class: {
    id: string;
    title: string;
    level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
    price_uzs: number;
    description: string | null;
    max_students: number;
    language: {
      id: string;
      name_ru: string;
      flag_emoji: string;
      color: string | null;
    };
    teacher: {
      id: string;
      user: {
        first_name: string;
        last_name: string | null;
        avatar_url: string | null;
      };
    };
    schedule_days: string[];
    schedule_time: string | null;
    schedule_duration: number | null;
  };
}

async function fetchMyEnrollments(): Promise<MyEnrollment[]> {
  const res = await apiClient.get<MyEnrollment[]>('/enrollments/my');
  return res.data;
}

export function useMyEnrollments() {
  return useQuery({
    queryKey: ['enrollments', 'my'],
    queryFn: fetchMyEnrollments,
  });
}

// ─── Manager: all enrollments ────────────────────────────────────────────────

export interface ManagerEnrollment {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'DROPPED';
  enrolled_at: string;
  student: {
    id: string;
    first_name: string;
    last_name: string | null;
    telegram_username: string | null;
  };
  class: {
    id: string;
    title: string;
    level: string;
    language: { name_ru: string; flag_emoji: string; color: string | null };
  };
}

export function useAllEnrollments(status?: string) {
  return useQuery<ManagerEnrollment[]>({
    queryKey: ['enrollments', 'all', status ?? 'ALL'],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const res = await apiClient.get<ManagerEnrollment[]>(`/enrollments${params}`);
      return res.data;
    },
  });
}

export function useUpdateEnrollmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'DROPPED' }) =>
      apiClient.patch(`/enrollments/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['enrollments'] }),
  });
}

// ─── Manager: all transfers ────────────────────────────────────────────────────

export interface ManagerTransfer {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  fee_uzs: number;
  reason: string | null;
  admin_note: string | null;
  created_at: string;
  student: {
    id: string;
    first_name: string;
    last_name: string | null;
    telegram_username: string | null;
  };
  from_class: { id: string; title: string };
  to_class: { id: string; title: string; max_students: number; _count: { enrollments: number } };
}

export function useAllTransfers(status?: string) {
  return useQuery<ManagerTransfer[]>({
    queryKey: ['transfers', 'all', status ?? 'all'],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const res = await apiClient.get<ManagerTransfer[]>(`/enrollments/transfer${params}`);
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useApproveTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, admin_note }: { id: string; admin_note?: string }) => {
      const res = await apiClient.patch(`/enrollments/transfer/${id}/approve`, { admin_note });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transfers'] });
    },
  });
}

export function useRejectTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, admin_note }: { id: string; admin_note?: string }) => {
      const res = await apiClient.patch(`/enrollments/transfer/${id}/reject`, { admin_note });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transfers'] });
    },
  });
}
