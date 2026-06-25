import { useQuery } from '@tanstack/react-query';

import { apiClient } from './client';

export interface AttendanceStat {
  classId: string;
  title: string;
  language: { name_ru: string; flag_emoji: string; color: string | null };
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  attendance_pct: number;
}

export function useMyAttendance() {
  return useQuery<AttendanceStat[]>({
    queryKey: ['attendance', 'my'],
    queryFn: () => apiClient.get<AttendanceStat[]>('/lessons/attendance/my').then((r) => r.data),
  });
}
