import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export type PointsLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface PointTx {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  created_at: string;
}

export interface MyPoints {
  points: number;
  total_earned_points: number;
  level: PointsLevel;
  next_level_points: number | null;
  point_value_uzs: number;
  transactions: PointTx[];
}

export interface PointsLeaderEntry {
  rank: number;
  name: string;
  avatar_url: string | null;
  total_earned_points: number;
  level: PointsLevel;
  is_me: boolean;
}

export function usePoints() {
  return useQuery({
    queryKey: ['points', 'me'],
    queryFn: async () => (await apiClient.get<MyPoints>('/points/me')).data,
    staleTime: 30_000,
  });
}

export function usePointsLeaderboard() {
  return useQuery({
    queryKey: ['points', 'leaderboard'],
    queryFn: async () => (await apiClient.get<PointsLeaderEntry[]>('/points/leaderboard')).data,
    staleTime: 60_000,
  });
}

/** Ручное начисление баллов админом/менеджером. */
export function useAwardPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: { user_id: string; amount: number; description?: string }) =>
      (await apiClient.post('/points/admin/award', dto)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['points'] }),
  });
}
