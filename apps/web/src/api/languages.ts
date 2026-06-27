import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

/** Категория направления — группирует каталог (языки vs экзамены). */
export type LanguageCategory = 'LANGUAGES' | 'IELTS' | 'SAT' | 'CEFR' | 'DTM' | 'MILLIY_SERTIFIKAT';

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

export interface CourseDetail {
  course: Language;
  classes: CourseClass[];
  recommended_class_id: string | null;
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
