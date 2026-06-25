import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface Certificate {
  id: string;
  file_url: string;
  issued_at: string;
  class: {
    id: string;
    title: string;
    level: string;
    language: { name_ru: string; flag_emoji: string };
  };
}

export function useMyCertificates() {
  return useQuery<Certificate[]>({
    queryKey: ['certificates', 'my'],
    queryFn: async () => {
      const res = await apiClient.get<Certificate[]>('/certificates/my');
      return res.data;
    },
    staleTime: 5 * 60_000,
  });
}
