import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at: string | null;
  sent_at: string | null;
  created_at: string;
  payload: Record<string, unknown>;
}

export function useNotifications() {
  return useQuery<NotificationItem[]>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get<NotificationItem[]>('/notifications');
      return res.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // auto-refresh every minute
  });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return data?.filter((n) => !n.read_at).length ?? 0;
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/notifications/${id}/read`);
      return id;
    },
    // Optimistic update — мгновенно помечаем прочитанным без refetch
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const prev = qc.getQueryData<NotificationItem[]>(['notifications']);
      qc.setQueryData<NotificationItem[]>(['notifications'], (old) =>
        old?.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.patch('/notifications/read-all');
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useSendTestNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ queued: true }>('/notifications/test');
      return res.data;
    },
    // Optimistic: insert a preview card immediately so user sees the UI at once
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ['notifications'] });
      const prev = qc.getQueryData<NotificationItem[]>(['notifications']);
      const preview: NotificationItem = {
        id: '__preview__',
        type: 'lesson_reminder',
        title: '🔔 Тестовое уведомление',
        body: 'Уведомления работают корректно! ✅\n\nЭто тест полного pipeline:\n• BullMQ очередь → Processor → Telegram бот → БД',
        read_at: null,
        sent_at: null,
        created_at: new Date().toISOString(),
        payload: { test: true },
      };
      qc.setQueryData<NotificationItem[]>(['notifications'], (old) => [preview, ...(old ?? [])]);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev);
    },
    onSuccess: () => {
      // Refetch after 3s — processor needs time to deliver real one
      setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['notifications'] });
      }, 3000);
    },
  });
}
