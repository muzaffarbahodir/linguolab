import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/** Категория направления — группирует каталог (языки vs экзамены). */
export type LanguageCategory = 'LANGUAGES' | 'IELTS' | 'SAT' | 'CEFR' | 'DTM' | 'MILLIY_SERTIFIKAT';

/** Порядок категорий в UI (опрос + чипсы каталога). */
export const CATEGORY_ORDER: LanguageCategory[] = [
  'LANGUAGES',
  'IELTS',
  'SAT',
  'CEFR',
  'DTM',
  'MILLIY_SERTIFIKAT',
];

/** Короткие подписи категорий для UI. */
export const CATEGORY_LABEL: Record<LanguageCategory, string> = {
  LANGUAGES: 'Языки',
  IELTS: 'IELTS',
  SAT: 'SAT',
  CEFR: 'CEFR',
  DTM: 'DTM',
  MILLIY_SERTIFIKAT: 'Milliy',
};

export interface Language {
  id: string;
  code: string;
  name_ru: string;
  flag_emoji: string;
  /** Категория для фильтра каталога. */
  category?: LanguageCategory;
  color: string | null;
  /** Картинка-баннер вместо цвета. */
  image_url?: string | null;
  /** Описание курса. */
  description?: string | null;
  /** Продолжительность: "3 месяца · 36 уроков". */
  duration_label?: string | null;
  /** Что входит в курс. */
  includes?: string[];
  /** Что нужно иметь (ноут, бюджет, знания). */
  requirements?: string[];
  /** Кол-во открытых групп (для баннера). */
  groups_count?: number;
  /** Кол-во активных студентов курса (соц-доказательство). */
  students_count?: number;
  /** Средний рейтинг курса по отзывам. */
  avg_rating?: number | null;
  /** Кол-во отзывов. */
  reviews_count?: number;
}

/** Класс (группа учителя) внутри курса. */
export interface CourseClass {
  id: string;
  title: string;
  level: string;
  price_uzs: number;
  price_usd: number;
  status: string;
  description: string | null;
  schedule_days: string[];
  schedule_time: string | null;
  schedule_duration: number | null;
  spots_left: number;
  max_students: number;
  teacher: {
    id: string;
    bio: string | null;
    photo_url: string | null;
    user: { first_name: string; last_name: string | null; avatar_url: string | null };
    avg_rating: number | null;
    ratings_count: number;
  };
}

/** Оффер учителя — «готов учить» ещё до открытия группы. */
export interface TeacherOffer {
  id: string;
  level: string | null;
  format: 'ONLINE' | 'OFFLINE' | null;
  price_uzs: number;
  price_usd: number;
  note: string | null;
  teacher: {
    id: string;
    bio: string | null;
    photo_url: string | null;
    user: { first_name: string; last_name: string | null; avatar_url: string | null };
    avg_rating: number | null;
    ratings_count: number;
  };
}

export interface LessonMaterial {
  title: string;
  url: string;
  type?: string;
}

/** Урок программы курса (как видит студент). Материалы открыты при превью/записи. */
export interface CourseLesson {
  id: string;
  order: number;
  title: string;
  description: string | null;
  duration_min: number | null;
  is_preview: boolean;
  unlocked: boolean;
  video_url: string | null;
  materials: LessonMaterial[];
  materials_count: number;
}

/** Урок в редакторе админа (полные поля). */
export interface AdminCourseLesson {
  id: string;
  language_id: string;
  order: number;
  title: string;
  description: string | null;
  duration_min: number | null;
  is_preview: boolean;
  video_url: string | null;
  materials: LessonMaterial[];
  is_active: boolean;
}

export interface CourseReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author: string;
  avatar_url: string | null;
  is_mine: boolean;
}

export interface MyReview {
  id: string;
  rating: number;
  comment: string | null;
  is_hidden: boolean;
}

export interface CourseDetail {
  course: Language;
  classes: CourseClass[];
  recommended_class_id: string | null;
  offers: TeacherOffer[];
  lessons: CourseLesson[];
  enrolled: boolean;
  rating: { avg: number | null; count: number };
  reviews: CourseReviewItem[];
  my_review: MyReview | null;
  can_review: boolean;
}

async function fetchLanguages(): Promise<Language[]> {
  const res = await apiClient.get<Language[]>('/languages');
  return res.data;
}

export function useLanguages() {
  return useQuery({
    queryKey: ['languages'],
    queryFn: fetchLanguages,
    staleTime: 5 * 60_000, // языки меняются редко — 5 мин
  });
}

export function useCourseDetail(languageId: string | undefined) {
  return useQuery({
    queryKey: ['course-detail', languageId],
    enabled: !!languageId,
    queryFn: async () => {
      const res = await apiClient.get<CourseDetail>(`/languages/${languageId}/course`);
      return res.data;
    },
  });
}

// ─── Программа курса — админ-редактор ──────────────────────────────────────────

export type LessonInput = Partial<Omit<AdminCourseLesson, 'id' | 'language_id'>>;

export function useAdminLessons(languageId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'lessons', languageId],
    enabled: !!languageId,
    queryFn: async () =>
      (await apiClient.get<AdminCourseLesson[]>(`/languages/${languageId}/lessons/admin`)).data,
  });
}

export function useUpsertLesson(languageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: LessonInput & { id?: string }) => {
      if (id) return (await apiClient.patch(`/languages/lessons/${id}`, dto)).data;
      return (await apiClient.post(`/languages/${languageId}/lessons`, dto)).data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'lessons', languageId] });
      void qc.invalidateQueries({ queryKey: ['course-detail', languageId] });
    },
  });
}

export function useDeleteLesson(languageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/languages/lessons/${id}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'lessons', languageId] });
      void qc.invalidateQueries({ queryKey: ['course-detail', languageId] });
    },
  });
}

// ─── Отзывы на курс ────────────────────────────────────────────────────────────

export function useUpsertReview(languageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { rating: number; comment?: string }) =>
      (await apiClient.post(`/languages/${languageId}/reviews`, body)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['course-detail', languageId] });
      void qc.invalidateQueries({ queryKey: ['languages'] });
    },
  });
}

export function useDeleteReview(languageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: string) =>
      (await apiClient.delete(`/languages/reviews/${reviewId}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['course-detail', languageId] });
      void qc.invalidateQueries({ queryKey: ['languages'] });
    },
  });
}

export function useHideReview(languageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, hidden }: { reviewId: string; hidden: boolean }) =>
      (await apiClient.patch(`/languages/reviews/${reviewId}/hide`, { hidden })).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['course-detail', languageId] });
    },
  });
}
