/**
 * Teachers public API — профили учителей, бейджи, перевод классов.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeacherLevel {
  label: string;
  color: string;
  verified?: boolean;
  min_votes?: number;
}

export interface TeacherBadge {
  id: string;
  title: string;
  description: string | null;
  icon: string;
  type: string;
  awarded_at: string;
}

export interface TeacherProfileClass {
  id: string;
  title: string;
  level: string;
  price_uzs: number;
  max_students: number;
  enrolled_count: number;
  spots_left: number;
  is_full: boolean;
  schedule_days: string[] | null;
  schedule_time: string | null;
  schedule_duration: number | null;
  description: string | null;
  language: { id: string; flag_emoji: string; name_ru: string; color: string | null };
}

export interface TeacherProfile {
  id: string;
  bio: string | null;
  photo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  telegram_url: string | null;
  avg_rating: number | null;
  ratings_count: number;
  stars_breakdown: { stars: number; count: number }[];
  level: TeacherLevel;
  badges: TeacherBadge[];
  classes: TeacherProfileClass[];
  recent_reviews?: { rating: number; comment: string | null }[];
  user: { id: string; first_name: string; last_name: string | null; avatar_url: string | null };
}

export interface TransferRequest {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  fee_uzs: number;
  reason: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  from_class: { id: string; title: string; language: { flag_emoji: string; name_ru: string } };
  to_class: { id: string; title: string; language: { flag_emoji: string; name_ru: string } };
}

// ─── API functions ────────────────────────────────────────────────────────────

async function fetchTeachers(): Promise<TeacherProfile[]> {
  const res = await apiClient.get<TeacherProfile[]>('/teachers');
  return res.data;
}

async function fetchTeacher(teacherId: string): Promise<TeacherProfile> {
  const res = await apiClient.get<TeacherProfile>(`/teachers/${teacherId}`);
  return res.data;
}

async function fetchTeacherByUserId(userId: string): Promise<TeacherProfile> {
  const res = await apiClient.get<TeacherProfile>(`/teachers/by-user/${userId}`);
  return res.data;
}

async function fetchMyTransfers(): Promise<TransferRequest[]> {
  const res = await apiClient.get<TransferRequest[]>('/enrollments/transfer/my');
  return res.data;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: fetchTeachers,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeacherProfile(teacherId: string) {
  return useQuery({
    queryKey: ['teachers', teacherId],
    queryFn: () => fetchTeacher(teacherId),
    enabled: !!teacherId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTeacherProfileByUserId(userId: string) {
  return useQuery({
    queryKey: ['teachers', 'by-user', userId],
    queryFn: () => fetchTeacherByUserId(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useMyTransfers() {
  return useQuery({
    queryKey: ['transfers', 'my'],
    queryFn: fetchMyTransfers,
    staleTime: 2 * 60 * 1000,
  });
}

export function useRequestTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { from_class_id: string; to_class_id: string; reason?: string }) => {
      const res = await apiClient.post<TransferRequest>('/enrollments/transfer', data);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transfers', 'my'] });
    },
  });
}

export function useCancelTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (transferId: string) => {
      const res = await apiClient.patch(`/enrollments/transfer/${transferId}/cancel`, {});
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['transfers', 'my'] });
    },
  });
}

export function useJoinWaitlist(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/classes/${classId}/waitlist`, {});
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teachers'] });
      void qc.invalidateQueries({ queryKey: ['teachers', classId] });
      void qc.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useLeaveWaitlist(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete(`/classes/${classId}/waitlist`);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teachers'] });
      void qc.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export interface MyTeacherRating {
  id: string;
  class_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export function useMyTeacherRating(teacherId: string) {
  return useQuery<MyTeacherRating[]>({
    queryKey: ['teachers', teacherId, 'my-rating'],
    queryFn: async () => {
      const res = await apiClient.get<MyTeacherRating[]>(`/teachers/${teacherId}/my-rating`);
      return res.data;
    },
    enabled: !!teacherId,
    staleTime: 60_000,
  });
}

export function useRateTeacher(teacherId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { class_id: string; rating: number; comment?: string }) => {
      const res = await apiClient.post(`/teachers/${teacherId}/rate`, data);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teachers', teacherId] });
      void qc.invalidateQueries({ queryKey: ['teachers', teacherId, 'my-rating'] });
    },
  });
}

export function useAwardBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teacherId,
      ...body
    }: {
      teacherId: string;
      title: string;
      icon: string;
      description?: string;
      type?: string;
    }) => apiClient.post(`/teachers/${teacherId}/badges`, body).then((r) => r.data),
    onSuccess: (_data, vars) =>
      void qc.invalidateQueries({ queryKey: ['teachers', vars.teacherId] }),
  });
}

export function useRemoveBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (badgeId: string) =>
      apiClient.delete(`/teachers/badges/${badgeId}`).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['teachers'] }),
  });
}

export function useUpdateTeacherProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      bio?: string;
      website_url?: string;
      instagram_url?: string;
      telegram_url?: string;
    }) => {
      const res = await apiClient.patch('/teachers/profile', data);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}
