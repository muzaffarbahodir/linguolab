import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface ClassTeacher {
  id: string;
  bio: string | null;
  photo_url: string | null;
  user: {
    first_name: string;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export type ClassStatus =
  | 'DRAFT'
  | 'ENROLLMENT_OPEN'
  | 'ACTIVE'
  | 'EXAM'
  | 'COMPLETED'
  | 'CANCELLED';

export interface ClassItem {
  id: string;
  title: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  price_uzs: number;
  price_usd: number;
  max_students: number;
  description: string | null;
  enrolled_count: number;
  spots_left: number;
  status: ClassStatus;
  semester_label: string | null;
  enrollment_opens_at: string | null;
  enrollment_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  language: {
    id: string;
    code: string;
    name_ru: string;
    flag_emoji: string;
    color: string | null;
  };
  teacher: ClassTeacher;
}

export interface EnrollResult {
  id: string;
  status: string;
  enrolled_at: string;
}

async function fetchClasses(languageId?: string, level?: string): Promise<ClassItem[]> {
  const params: Record<string, string> = {};
  if (languageId) params.languageId = languageId;
  if (level) params.level = level;
  const res = await apiClient.get<ClassItem[]>('/classes', { params });
  return res.data;
}

async function enrollClass(classId: string): Promise<EnrollResult> {
  const res = await apiClient.post<EnrollResult>(`/classes/${classId}/enroll`);
  return res.data;
}

export function useClasses(languageId?: string, level?: string) {
  return useQuery({
    queryKey: ['classes', languageId ?? 'all', level ?? 'all'],
    queryFn: () => fetchClasses(languageId, level),
  });
}

export function useSetClassSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      classId,
      schedule_days,
      schedule_time,
      schedule_duration,
      starts_at,
    }: {
      classId: string;
      schedule_days: string[];
      schedule_time: string;
      schedule_duration: number;
      starts_at?: string | null;
    }) =>
      apiClient
        .patch(`/classes/${classId}/schedule`, {
          schedule_days,
          schedule_time,
          schedule_duration,
          starts_at,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'classes'] });
      void qc.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useEnrollClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: enrollClass,
    onSuccess: () => {
      // инвалидируем список классов чтобы обновить enrolled_count
      void queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}
