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

export interface SpokenLanguage {
  name: string;
  level: string;
}

export interface EducationEntry {
  title: string;
  org?: string;
  year?: number;
}

export interface TeacherReview {
  rating: number;
  comment: string | null;
  created_at: string | null;
  class_title: string | null;
  author: { name: string; avatar_url: string | null } | null;
}

export interface TeacherProfile {
  id: string;
  bio: string | null;
  photo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  telegram_url: string | null;
  /** Строка-специализация под именем. */
  headline: string | null;
  intro_video_url: string | null;
  intro_video_poster: string | null;
  country: string | null;
  experience_years: number | null;
  specializations: string[];
  /** Черты преподавателя — проставляет менеджер, не сам преподаватель. */
  highlights: string[];
  speaks: SpokenLanguage[];
  education: EducationEntry[];
  avg_rating: number | null;
  ratings_count: number;
  stars_breakdown: { stars: number; count: number }[];
  level: TeacherLevel;
  /** Проведённые уроки за всё время, включая закрытые курсы. */
  lessons_conducted: number;
  /** Сколько учеников занимается сейчас. */
  students_count: number;
  badges: TeacherBadge[];
  classes: TeacherProfileClass[];
  recent_reviews?: TeacherReview[];
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

/** Группа, куда можно перевестись, с уже посчитанной ценой перевода. */
export interface TransferOption {
  id: string;
  title: string;
  level: string;
  format: 'ONLINE' | 'OFFLINE';
  price_uzs: number;
  schedule_days: string[];
  schedule_time: string | null;
  spots_left: number;
  is_full: boolean;
  fee_uzs: number;
  teacher: {
    id: string;
    first_name: string;
    last_name: string | null;
    photo_url: string | null;
    avg_rating: number | null;
  };
}

/**
 * Куда можно перевестись из этой группы.
 *
 * Раньше форма просила вставить ID класса, которого студент нигде не видит.
 */
export function useTransferOptions(fromClassId: string) {
  return useQuery<TransferOption[]>({
    queryKey: ['transfers', 'options', fromClassId],
    queryFn: async () =>
      (
        await apiClient.get<TransferOption[]>('/enrollments/transfer/options', {
          params: { fromClassId },
        })
      ).data,
    enabled: !!fromClassId,
    staleTime: 60_000,
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

export interface UpdateTeacherProfileInput {
  bio?: string;
  photo_url?: string | null;
  website_url?: string;
  instagram_url?: string;
  telegram_url?: string;
  headline?: string;
  intro_video_url?: string | null;
  intro_video_poster?: string | null;
  country?: string;
  experience_years?: number;
  specializations?: string[];
  speaks?: SpokenLanguage[];
  education?: EducationEntry[];
}

export function useUpdateTeacherProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateTeacherProfileInput) => {
      const res = await apiClient.patch('/teachers/profile', data);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}

/** Черты преподавателя — доступно менеджеру, не самому преподавателю. */
export function useSetTeacherHighlights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teacherId, highlights }: { teacherId: string; highlights: string[] }) => {
      const res = await apiClient.patch(`/teachers/${teacherId}/highlights`, { highlights });
      return res.data;
    },
    onSuccess: (_data, vars) =>
      void qc.invalidateQueries({ queryKey: ['teachers', vars.teacherId] }),
  });
}
