import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface Certificate {
  id: string;
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

/**
 * Прислать сертификат файлом в чат с ботом.
 *
 * Раньше кнопка открывала прямую ссылку на CDN: было видно и хранилище, и
 * ключ файла, а на телефоне документ открывался в браузере вместо того, чтобы
 * сохраниться. Через бота файл приходит в переписку и остаётся там навсегда.
 */
export function useSendCertificate() {
  return useMutation({
    mutationFn: async (certificateId: string) => {
      const res = await apiClient.post(`/certificates/${certificateId}/send`);
      return res.data as { ok: boolean };
    },
  });
}
