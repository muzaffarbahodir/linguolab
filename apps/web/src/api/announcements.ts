import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export type AnnouncementStyle = 'CAUTION' | 'INFO' | 'PROMO';
export type AnnouncementPosition = 'TOP' | 'BOTTOM';
export type AnnouncementRecurrence = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type AudienceRole = 'STUDENT' | 'TEACHER' | 'MANAGER' | 'PARENT' | 'ADMIN' | 'SUPER_ADMIN';

/** Активный баннер (бегущая строка) — то, что видит студент. */
export interface ActiveAnnouncement {
  id: string;
  text: string;
  style: AnnouncementStyle;
  position: AnnouncementPosition;
}

/** Полный баннер для панели управления. */
export interface AdminAnnouncement extends ActiveAnnouncement {
  is_active: boolean;
  sort_order: number;
  expires_at: string | null;
  audience_roles: AudienceRole[];
  target_user_id: string | null;
  target_username: string | null;
  recurrence: AnnouncementRecurrence;
  recurrence_day: number | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertAnnouncementInput {
  text?: string;
  style?: AnnouncementStyle;
  position?: AnnouncementPosition;
  is_active?: boolean;
  sort_order?: number;
  /** Длительность показа в минутах. 0 = бессрочно. */
  duration_minutes?: number;
  /** Роли-получатели (пусто = все). */
  audience_roles?: AudienceRole[];
  /** Конкретный пользователь по @username (бэк резолвит в id). '' = снять. */
  target_username?: string;
  recurrence?: AnnouncementRecurrence;
  recurrence_day?: number | null;
  /** При создании: также отправить в чат + уведомление. */
  broadcast?: boolean;
}

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: async () => {
      const res = await apiClient.get<ActiveAnnouncement[]>('/announcements/active');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: async () => {
      const res = await apiClient.get<AdminAnnouncement[]>('/announcements');
      return res.data;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    void qc.invalidateQueries({ queryKey: ['announcements'] });
  };
}

export function useCreateAnnouncement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: UpsertAnnouncementInput) =>
      apiClient.post<AdminAnnouncement>('/announcements', input).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useUpdateAnnouncement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: UpsertAnnouncementInput & { id: string }) =>
      apiClient.patch<AdminAnnouncement>(`/announcements/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeleteAnnouncement() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/announcements/${id}`).then((r) => r.data),
    onSuccess: invalidate,
  });
}
