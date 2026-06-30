import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface MyClassRequestItem {
  id: string;
  title: string;
  level: string;
  description: string | null;
  schedule_days: string[];
  schedule_time: string | null;
  schedule_duration: number | null;
  starts_at: string | null;
  ends_at: string | null;
  max_students: number;
  meeting_url: string | null;
  course_duration: string | null;
  course_includes: string[];
  course_requirements: string[];
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  language: { id: string; name_ru: string; flag_emoji: string; code: string };
  approved_class: { id: string; title: string; status: string } | null;
}

export function useMyClassRequests() {
  return useQuery({
    queryKey: ['class-requests', 'my'],
    queryFn: async () => {
      const res = await apiClient.get<MyClassRequestItem[]>('/class-requests/my');
      return res.data;
    },
  });
}

export function useCreateClassRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      language_id: string;
      title: string;
      level: string;
      description?: string;
      schedule_days?: string[];
      schedule_time?: string;
      schedule_duration?: number;
      starts_at?: string;
      ends_at?: string;
      max_students?: number;
      meeting_url?: string;
      course_duration?: string;
      course_includes?: string[];
      course_requirements?: string[];
      note?: string;
    }) => {
      const res = await apiClient.post('/class-requests', dto);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['class-requests', 'my'] }),
  });
}
