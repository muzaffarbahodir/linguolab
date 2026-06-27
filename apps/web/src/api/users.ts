import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { LanguageCategory } from './languages';

export type StudyFormat = 'ONLINE' | 'OFFLINE';
export type StudyMode = 'INDIVIDUAL' | 'GROUP';

export interface UserMe {
  id: string;
  telegram_user_id: string;
  telegram_username: string | null;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  locale: string;
  preferred_currency: string;
  timezone: string;
  gender: 'MALE' | 'FEMALE' | null;
  birth_date: string | null;
  /** Преференсы подбора курса (опрос-онбординг). */
  study_format: StudyFormat | null;
  study_mode: StudyMode | null;
  preferred_category: LanguageCategory | null;
  /** Прошёл опрос подбора — null если ещё нет. */
  discovery_done_at: string | null;
  last_active_at: string;
  created_at: string;
}

/** Ответы опроса подбора курса. */
export interface DiscoveryInput {
  study_format: StudyFormat;
  study_mode?: StudyMode | null;
  preferred_category?: LanguageCategory | null;
}

export interface StudentStats {
  lessons_attended: number;
  lessons_total: number;
  streak_days: number;
  avg_grade: number | null;
}

export interface UserProgress {
  active_enrollments: number;
  classes: Array<{
    class_title: string;
    level: string;
    language: { name_ru: string; flag_emoji: string; color: string };
    enrolled_at: string;
  }>;
  homework: {
    submitted: number;
    graded: number;
    total: number;
  };
  achievements_count: number;
  placement_test: {
    level_assigned: string;
    score: number;
    completed_at: string;
  } | null;
}

async function fetchMe(): Promise<UserMe> {
  const res = await apiClient.get<UserMe>('/users/me');
  return res.data;
}

async function fetchProgress(): Promise<UserProgress> {
  const res = await apiClient.get<UserProgress>('/users/me/progress');
  return res.data;
}

/**
 * Вычисляет процент прогресса из данных API.
 * Формула:
 *   +20  за активную запись в класс (max 20)
 *   +50  за выполненные ДЗ (graded/total * 50)
 *   +20  за достижения (min(count*4, 20))
 *   +10  за пройденный тест уровня
 */
export function calcProgress(p: UserProgress): number {
  let score = 0;
  if (p.active_enrollments > 0) score += 20;
  if (p.homework.total > 0) {
    score += Math.round((p.homework.graded / p.homework.total) * 50);
  }
  score += Math.min(p.achievements_count * 4, 20);
  if (p.placement_test) score += 10;
  return Math.min(score, 100);
}

export function useMe() {
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: fetchMe,
  });
}

export function useProgress() {
  return useQuery({
    queryKey: ['users', 'me', 'progress'],
    queryFn: fetchProgress,
    staleTime: 60_000,
  });
}

export function useStudentStats() {
  return useQuery<StudentStats>({
    queryKey: ['users', 'me', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<StudentStats>('/users/me/stats');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface RecentLesson {
  title: string | null;
  scheduled_at: string;
  status: AttendanceStatus;
  class_title: string;
  language: { name_ru: string; flag_emoji: string; color: string };
}

export function useRecentLessons() {
  return useQuery<RecentLesson[]>({
    queryKey: ['users', 'me', 'lessons', 'recent'],
    queryFn: async () => {
      const res = await apiClient.get<RecentLesson[]>('/users/me/lessons/recent');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export interface PatchMeDto {
  first_name?: string;
  last_name?: string;
  locale?: string;
  preferred_currency?: string;
  timezone?: string;
  avatar_url?: string;
  gender?: 'MALE' | 'FEMALE' | null;
  birth_date?: string | null;
}

export function usePatchMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: PatchMeDto) => {
      const res = await apiClient.patch<UserMe>('/users/me', dto);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
    },
  });
}

/** Self-service онбординг: выбор роли (студент/родитель) + авто-активация. */
export function useOnboard() {
  return useMutation({
    mutationFn: async (role: 'STUDENT' | 'PARENT') => {
      const res = await apiClient.patch('/users/me/onboard', { role });
      return res.data as { id: string; role: string; is_active: boolean };
    },
  });
}

/** Сохранить ответы опроса подбора курса + отметить визард пройденным. */
export function useSaveDiscovery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: DiscoveryInput) => {
      const res = await apiClient.patch('/users/me/discovery', dto);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', 'me'] });
    },
  });
}
