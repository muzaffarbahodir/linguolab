import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface UpcomingLessonItem {
  id: string;
  title: string | null;
  scheduled_at: string;
  duration_min: number;
  status: string;
  class: {
    id: string;
    title: string;
    language: { name_ru: string; flag_emoji: string; color: string | null };
    teacher_name: string;
  };
}

export interface UpcomingLesson {
  id: string;
  language: {
    id: string;
    name_ru: string;
    flag_emoji: string;
    color: string | null;
  };
  teacher: {
    id: string;
    name: string;
  };
  scheduled_at: string;
  duration_minutes: number;
}

async function fetchUpcomingLesson(): Promise<UpcomingLesson> {
  const res = await apiClient.get<UpcomingLesson>('/lessons/upcoming');
  return res.data;
}

export function useUpcomingLesson() {
  return useQuery({
    queryKey: ['lessons', 'upcoming'],
    queryFn: fetchUpcomingLesson,
  });
}

export interface AttendanceHistoryItem {
  id: string;
  title: string | null;
  scheduled_at: string;
  duration_min: number;
  status: string;
  class: {
    title: string;
    language: { name_ru: string; flag_emoji: string };
  };
  attendances: Array<{ status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' }>;
}

export function useAttendanceHistory(limit = 30) {
  return useQuery({
    queryKey: ['lessons', 'history', limit],
    queryFn: async () => {
      const res = await apiClient.get<AttendanceHistoryItem[]>(`/lessons/history`);
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: [] as AttendanceHistoryItem[],
  });
}

export function useUpcomingLessonsList(limit = 10) {
  return useQuery({
    queryKey: ['lessons', 'upcoming-list', limit],
    queryFn: async () => {
      const res = await apiClient.get<UpcomingLessonItem[]>(
        `/lessons/upcoming-list?limit=${limit}`,
      );
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [] as UpcomingLessonItem[],
  });
}
