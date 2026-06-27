import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface MyOffer {
  id: string;
  language_id: string;
  level: string | null;
  format: 'ONLINE' | 'OFFLINE' | null;
  price_uzs: number;
  price_usd: number;
  note: string | null;
  is_active: boolean;
  created_at: string;
  language: { id: string; name_ru: string; flag_emoji: string; color: string | null };
}

export interface UpsertOfferInput {
  language_id: string;
  level?: string | null;
  format?: 'ONLINE' | 'OFFLINE' | null;
  price_uzs?: number;
  price_usd?: number;
  note?: string | null;
  is_active?: boolean;
}

/** GET /teacher-offers/my — офферы текущего учителя. */
export function useMyOffers() {
  return useQuery<MyOffer[]>({
    queryKey: ['teacher-offers', 'my'],
    queryFn: () => apiClient.get<MyOffer[]>('/teacher-offers/my').then((r) => r.data),
  });
}

/** POST /teacher-offers — создать/обновить оффер. */
export function useUpsertOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertOfferInput) =>
      apiClient.post<MyOffer>('/teacher-offers', input).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-offers', 'my'] }),
  });
}

/** DELETE /teacher-offers/:id — удалить оффер. */
export function useDeleteOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/teacher-offers/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teacher-offers', 'my'] }),
  });
}
