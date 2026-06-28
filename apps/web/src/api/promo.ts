import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface PromoValidation {
  valid: boolean;
  discount_percent: number;
  code?: string;
  reason?: 'not_found' | 'expired' | 'used_up';
}

/** Проверить промокод (студент). */
export function useValidatePromo() {
  return useMutation({
    mutationFn: async (code: string) =>
      (await apiClient.post<PromoValidation>('/promo/validate', { code })).data,
  });
}

// ─── Admin ─────────────────────────────────────────────────────────────────────

export interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export type PromoInput = Partial<Omit<PromoCode, 'id' | 'used_count' | 'created_at'>>;

export function useAdminPromos() {
  return useQuery({
    queryKey: ['admin', 'promos'],
    queryFn: async () => (await apiClient.get<PromoCode[]>('/promo/admin')).data,
  });
}

export function useUpsertPromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: PromoInput & { id?: string }) => {
      if (id) return (await apiClient.patch(`/promo/${id}`, dto)).data;
      return (await apiClient.post('/promo', dto)).data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'promos'] }),
  });
}

export function useDeletePromo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await apiClient.delete(`/promo/${id}`)).data,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'promos'] }),
  });
}
