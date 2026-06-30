import { useQuery } from '@tanstack/react-query';
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
