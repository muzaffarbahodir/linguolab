import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeacherInfo {
  id: string;
  bio: string | null;
  user: { first_name: string; last_name: string | null; avatar_url: string | null };
  avg_rating: number | null;
  ratings_count: number;
}

export interface ChildClass {
  id: string;
  title: string;
  level: string;
  schedule_days: string[];
  schedule_time: string | null;
  schedule_duration: number | null;
  language: { name_ru: string; flag_emoji: string; color: string | null };
  teacher: TeacherInfo;
}

export interface ChildInfo {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  active_classes: ChildClass[];
}

export interface ChildListItem {
  link_id: string;
  linked_at: string;
  child: {
    id: string;
    first_name: string;
    last_name: string | null;
    avatar_url: string | null;
    active_classes: { id: string; title: string; language: { flag_emoji: string } }[];
  };
}

export interface ChildOverview {
  child: ChildInfo;
  stats: {
    attendance_pct: number | null;
    month_attendance_pct: number | null;
    month_lessons_total: number;
    month_lessons_present: number;
    total_lessons: number;
    avg_grade: number | null;
    hw_total: number;
    hw_submitted: number;
  };
  ranking: {
    class_id: string;
    class_title: string;
    rank: number;
    total: number;
    student_pct: number;
  } | null;
  level_ranking: { rank: number; total: number; pct: number } | null;
  level: { level: string; score: number | null } | null;
  upcoming_lesson: {
    id: string;
    title: string;
    scheduled_at: string;
    duration_min: number;
    class_title: string;
    language: { flag_emoji: string; name_ru: string };
  } | null;
  last_homework: {
    id: string;
    title: string;
    due_date: string | null;
    submission: { status: string; grade: number | null } | null;
  } | null;
}

export interface ChildAttendanceItem {
  id: string;
  status: string;
  lesson: {
    scheduled_at: string;
    title: string;
    class: { title: string; language: { flag_emoji: string } };
  };
}

export interface ChildHomeworkItem {
  id: string;
  title: string;
  due_date: string | null;
  created_at: string;
  class: { title: string };
  submissions: {
    status: string;
    grade: number | null;
    submitted_at: string | null;
    graded_at: string | null;
    feedback: string | null;
  }[];
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useMyChildren() {
  return useQuery<ChildListItem[]>({
    queryKey: ['parent', 'children'],
    queryFn: async () => {
      const res = await apiClient.get<ChildListItem[]>('/parents/children');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useChildOverview(childId: string) {
  return useQuery<ChildOverview>({
    queryKey: ['parent', 'child', childId, 'overview'],
    queryFn: async () => {
      const res = await apiClient.get<ChildOverview>(`/parents/children/${childId}/overview`);
      return res.data;
    },
    staleTime: 60_000,
    enabled: !!childId,
  });
}

export function useChildAttendance(childId: string) {
  return useQuery<ChildAttendanceItem[]>({
    queryKey: ['parent', 'child', childId, 'attendance'],
    queryFn: async () => {
      const res = await apiClient.get<ChildAttendanceItem[]>(
        `/parents/children/${childId}/attendance`,
      );
      return res.data;
    },
    staleTime: 60_000,
    enabled: !!childId,
  });
}

export function useChildHomework(childId: string) {
  return useQuery<ChildHomeworkItem[]>({
    queryKey: ['parent', 'child', childId, 'homework'],
    queryFn: async () => {
      const res = await apiClient.get<ChildHomeworkItem[]>(`/parents/children/${childId}/homework`);
      return res.data;
    },
    staleTime: 60_000,
    enabled: !!childId,
  });
}

export function useCreateInvite() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ code: string; expires_at: string }>('/parents/invite');
      return res.data;
    },
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const res = await apiClient.post(`/parents/invite/${code}/accept`);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['parent'] });
    },
  });
}

export function useUnlinkChild() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (childId: string) => {
      await apiClient.delete(`/parents/children/${childId}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['parent', 'children'] });
    },
  });
}

// ─── Teacher student view hooks ───────────────────────────────────────────────

export interface TeacherStudentOverview extends ChildOverview {
  my_rating: { rating: number; comment: string | null } | null;
}

export function useTeacherStudentOverview(classId: string, studentId: string) {
  return useQuery<TeacherStudentOverview>({
    queryKey: ['teacher', 'class', classId, 'student', studentId, 'overview'],
    queryFn: async () => {
      const res = await apiClient.get<TeacherStudentOverview>(
        `/classes/${classId}/students/${studentId}/overview`,
      );
      return res.data;
    },
    staleTime: 60_000,
    enabled: !!classId && !!studentId,
  });
}

export function useTeacherStudentAttendance(classId: string, studentId: string) {
  return useQuery<ChildAttendanceItem[]>({
    queryKey: ['teacher', 'class', classId, 'student', studentId, 'attendance'],
    queryFn: async () => {
      const res = await apiClient.get<ChildAttendanceItem[]>(
        `/classes/${classId}/students/${studentId}/attendance`,
      );
      return res.data;
    },
    staleTime: 60_000,
    enabled: !!classId && !!studentId,
  });
}

export function useTeacherStudentHomework(classId: string, studentId: string) {
  return useQuery<ChildHomeworkItem[]>({
    queryKey: ['teacher', 'class', classId, 'student', studentId, 'homework'],
    queryFn: async () => {
      const res = await apiClient.get<ChildHomeworkItem[]>(
        `/classes/${classId}/students/${studentId}/homework`,
      );
      return res.data;
    },
    staleTime: 60_000,
    enabled: !!classId && !!studentId,
  });
}

// ─── Teacher rating hooks ─────────────────────────────────────────────────────

export interface TeacherRatingData {
  avg_rating: number | null;
  total_ratings: number;
  ratings: { rating: number; comment: string | null; created_at: string }[];
}

export function useTeacherRating(classId: string) {
  return useQuery<TeacherRatingData>({
    queryKey: ['class', classId, 'teacher-rating'],
    queryFn: async () => {
      const res = await apiClient.get<TeacherRatingData>(`/classes/${classId}/teacher/rating`);
      return res.data;
    },
    staleTime: 120_000,
    enabled: !!classId,
  });
}

export function useMyTeacherRating(classId: string) {
  return useQuery<{ rating: number; comment: string | null } | null>({
    queryKey: ['class', classId, 'my-rating'],
    queryFn: async () => {
      const res = await apiClient.get<{ rating: number; comment: string | null } | null>(
        `/classes/${classId}/my-rating`,
      );
      return res.data;
    },
    staleTime: 60_000,
    enabled: !!classId,
  });
}

export function useRateTeacher(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rating, comment }: { rating: number; comment?: string }) => {
      const res = await apiClient.post(`/classes/${classId}/rate`, { rating, comment });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['class', classId, 'teacher-rating'] });
      void qc.invalidateQueries({ queryKey: ['class', classId, 'my-rating'] });
    },
  });
}
