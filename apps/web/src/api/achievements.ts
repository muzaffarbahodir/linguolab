import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Achievement {
  id: string;
  trigger: string;
  title_ru: string;
  title_uz: string;
  title_en: string;
  description_ru: string;
  description_uz: string;
  description_en: string;
  icon: string;
  is_unlocked: boolean;
  unlocked_at?: string;
}

export interface MyAchievementsResponse {
  unlocked: Achievement[];
  locked: Achievement[];
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchMyAchievements(): Promise<MyAchievementsResponse> {
  const res = await apiClient.get<MyAchievementsResponse>('/achievements/my');
  return res.data;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMyAchievements() {
  return useQuery({
    queryKey: ['achievements', 'my'],
    queryFn: fetchMyAchievements,
  });
}
