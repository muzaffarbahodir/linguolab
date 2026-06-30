/**
 * Teacher API — запросы для личного кабинета учителя в TWA.
 *
 * Все эндпоинты требуют JWT с ролью TEACHER/MANAGER/ADMIN.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeacherClass {
  id: string;
  title: string;
  level: string;
  language: { name_ru: string; flag_emoji: string; color: string | null };
  teacher: { id: string; user: { first_name: string; last_name: string | null } };
  enrolled_count: number;
  spots_left: number;
  max_students: number;
  schedule_days: string[];
  schedule_time: string | null;
  schedule_duration: number | null;
  latest_lesson: { id: string; scheduled_at: string; status: string } | null;
}

export interface TeacherStudent {
  id: string;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
}

export interface TeacherLesson {
  id: string;
  class_id: string;
  title: string | null;
  scheduled_at: string;
  duration_min: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  _count?: { attendances: number };
}

export interface TeacherAttendanceRecord {
  id: string;
  student_id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  note: string | null;
}

export interface TeacherHomework {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
}

export interface TeacherSubmission {
  id: string;
  homework_id: string;
  student_id: string;
  status: 'SUBMITTED' | 'GRADED' | 'LATE';
  grade: number | null;
  feedback: string | null;
  text_answer: string | null;
  file_url: string | null;
  submitted_at: string;
  graded_at: string | null;
  student: { id: string; first_name: string; last_name: string | null };
}

export interface TeacherStats {
  classes_count: number;
  total_lessons: number;
  total_students: number;
  avg_attendance_pct: number;
  homework_graded: number;
}

export interface StudentStat {
  student: { id: string; first_name: string; last_name: string | null; avatar_url: string | null };
  attendance: { present: number; total: number; pct: number | null };
  homework: { submitted: number; total: number };
}

export interface TodayLesson {
  id: string;
  title: string | null;
  scheduled_at: string;
  duration_min: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  class: {
    id: string;
    title: string;
    language: { name_ru: string; flag_emoji: string };
    enrolled_count: number;
  };
  attendance_count: number;
}

export interface PendingSubmission {
  id: string;
  homework_id: string;
  student_id: string;
  status: 'SUBMITTED' | 'GRADED' | 'LATE';
  grade: number | null;
  feedback: string | null;
  text_answer: string | null;
  file_url: string | null;
  submitted_at: string;
  student: { id: string; first_name: string; last_name: string | null };
  homework: {
    id: string;
    title: string;
    class: { id: string; title: string };
  };
}

export interface ClassSetup {
  id: string;
  title: string;
  schedule_days: string[];
  schedule_time: string | null;
  schedule_duration: number | null;
  starts_at: string | null;
  ends_at: string | null;
  meeting_url: string | null;
  lessons_count: number;
}

export interface SetSchedulePayload {
  schedule_days: string[];
  schedule_time: string;
  schedule_duration: number;
  starts_at?: string | null;
}

export interface CreateLessonPayload {
  classId: string;
  title?: string;
  scheduledAt: string; // ISO 8601
  durationMin?: number;
  notes?: string;
}

export interface CreateHomeworkPayload {
  class_id: string;
  title: string;
  description?: string;
  due_date?: string;
}

export interface BulkAttendancePayload {
  attendances: Array<{
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    note?: string;
  }>;
}

export interface GradePayload {
  grade: number;
  feedback?: string;
}

// ─── API functions ────────────────────────────────────────────────────────────

async function fetchMyClasses(): Promise<TeacherClass[]> {
  const res = await apiClient.get<TeacherClass[]>('/classes/my');
  return res.data;
}

async function fetchClassStudents(classId: string): Promise<TeacherStudent[]> {
  const res = await apiClient.get<TeacherStudent[]>(`/classes/${classId}/students`);
  return res.data;
}

async function fetchClassLessons(classId: string): Promise<TeacherLesson[]> {
  const res = await apiClient.get<TeacherLesson[]>(`/lessons/class/${classId}`);
  return res.data;
}

async function fetchLessonAttendance(lessonId: string): Promise<TeacherAttendanceRecord[]> {
  const res = await apiClient.get<TeacherAttendanceRecord[]>(`/lessons/${lessonId}/attendance`);
  return res.data;
}

async function fetchClassHomework(classId: string): Promise<TeacherHomework[]> {
  const res = await apiClient.get<TeacherHomework[]>(`/homework/class/${classId}`);
  return res.data;
}

async function fetchHomeworkSubmissions(homeworkId: string): Promise<TeacherSubmission[]> {
  const res = await apiClient.get<TeacherSubmission[]>(`/homework/${homeworkId}/submissions`);
  return res.data;
}

async function createLesson(payload: CreateLessonPayload): Promise<TeacherLesson> {
  const res = await apiClient.post<TeacherLesson>('/lessons', payload);
  return res.data;
}

async function createHomework(payload: CreateHomeworkPayload): Promise<TeacherHomework> {
  const res = await apiClient.post<TeacherHomework>('/homework', payload);
  return res.data;
}

async function bulkAttendance(lessonId: string, payload: BulkAttendancePayload): Promise<void> {
  await apiClient.post(`/lessons/${lessonId}/attendance/bulk`, payload);
}

async function gradeSubmission(submissionId: string, payload: GradePayload): Promise<void> {
  await apiClient.patch(`/homework/submissions/${submissionId}/grade`, payload);
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMyClasses() {
  return useQuery({ queryKey: ['teacher', 'classes'], queryFn: fetchMyClasses });
}

export function useClassStudents(classId: string) {
  return useQuery({
    queryKey: ['teacher', 'class', classId, 'students'],
    queryFn: () => fetchClassStudents(classId),
    enabled: !!classId,
  });
}

export function useClassLessons(classId: string) {
  return useQuery({
    queryKey: ['teacher', 'class', classId, 'lessons'],
    queryFn: () => fetchClassLessons(classId),
    enabled: !!classId,
  });
}

export function useLessonAttendance(lessonId: string) {
  return useQuery({
    queryKey: ['teacher', 'lesson', lessonId, 'attendance'],
    queryFn: () => fetchLessonAttendance(lessonId),
    enabled: !!lessonId,
  });
}

export function useClassHomework(classId: string) {
  return useQuery({
    queryKey: ['teacher', 'class', classId, 'homework'],
    queryFn: () => fetchClassHomework(classId),
    enabled: !!classId,
  });
}

export function useHomeworkSubmissions(homeworkId: string) {
  return useQuery({
    queryKey: ['teacher', 'homework', homeworkId, 'submissions'],
    queryFn: () => fetchHomeworkSubmissions(homeworkId),
    enabled: !!homeworkId,
  });
}

export function useCreateLesson(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createLesson,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher', 'class', classId, 'lessons'] });
    },
  });
}

export function useCreateHomework(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createHomework,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher', 'class', classId, 'homework'] });
    },
  });
}

export function useBulkAttendance(lessonId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkAttendancePayload) => bulkAttendance(lessonId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher', 'lesson', lessonId, 'attendance'] });
    },
  });
}

export function useIssueCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ student_id, class_id }: { student_id: string; class_id: string }) =>
      apiClient.post('/certificates/issue', { student_id, class_id }).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['certificates'] }),
  });
}

export function useTeacherStats() {
  return useQuery({
    queryKey: ['teacher', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<TeacherStats>('/lessons/teacher/stats');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: {
      classes_count: 0,
      total_lessons: 0,
      total_students: 0,
      avg_attendance_pct: 0,
      homework_graded: 0,
    },
  });
}

export function useClassStudentStats(classId: string) {
  return useQuery({
    queryKey: ['teacher', 'class', classId, 'student-stats'],
    queryFn: async () => {
      const res = await apiClient.get<StudentStat[]>(`/classes/${classId}/student-stats`);
      return res.data;
    },
    enabled: !!classId,
    staleTime: 2 * 60 * 1000,
    placeholderData: [] as StudentStat[],
  });
}

export function useTeacherToday() {
  return useQuery({
    queryKey: ['teacher', 'today'],
    queryFn: async () => {
      const res = await apiClient.get<TodayLesson[]>('/lessons/teacher/today');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [] as TodayLesson[],
  });
}

export function useTeacherPendingHw() {
  return useQuery({
    queryKey: ['teacher', 'pending-hw'],
    queryFn: async () => {
      const res = await apiClient.get<PendingSubmission[]>('/lessons/teacher/pending-hw');
      return res.data;
    },
    staleTime: 3 * 60 * 1000,
    placeholderData: [] as PendingSubmission[],
  });
}

export function useClassSetup(classId: string) {
  return useQuery({
    queryKey: ['teacher', 'class', classId, 'setup'],
    queryFn: async () => {
      const res = await apiClient.get<ClassSetup>(`/classes/${classId}/setup`);
      return res.data;
    },
    enabled: !!classId,
  });
}

export function useSetTeacherSchedule(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetSchedulePayload) =>
      apiClient.patch(`/classes/${classId}/schedule`, payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher', 'class', classId, 'setup'] });
      void qc.invalidateQueries({ queryKey: ['teacher', 'classes'] });
    },
  });
}

export function useSetMeetingUrl(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meeting_url: string) =>
      apiClient.patch(`/classes/${classId}/meeting`, { meeting_url }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher', 'class', classId, 'setup'] });
    },
  });
}

export function useGenerateLessons(classId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (weeks: number) => {
      const res = await apiClient.post<{ created: number; skipped: number }>(
        `/lessons/class/${classId}/generate`,
        { weeks },
      );
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher', 'class', classId, 'lessons'] });
      void qc.invalidateQueries({ queryKey: ['teacher', 'today'] });
      void qc.invalidateQueries({ queryKey: ['teacher', 'classes'] });
    },
  });
}

export function useGradeSubmission(homeworkId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, payload }: { submissionId: string; payload: GradePayload }) =>
      gradeSubmission(submissionId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['teacher', 'homework', homeworkId, 'submissions'] });
    },
  });
}
