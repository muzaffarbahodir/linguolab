import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiClient } from './client';

export interface MyReferral {
  code: string;
  used_count: number;
  bonus_days_granted: number;
  created_at: string;
}

export function useMyReferral() {
  return useQuery<MyReferral>({
    queryKey: ['referrals', 'my'],
    queryFn: () => apiClient.get<MyReferral>('/referrals/my').then((r) => r.data),
  });
}

export function useRedeemReferral() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiClient
        .post<{ success: boolean; message: string }>('/referrals/redeem', { code })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['referrals'] });
    },
  });
}
