/**
 * Toast store — Zustand. In-app уведомления взамен нативного WebApp.showAlert.
 *
 * Зачем: showAlert блокирует UI, не стилизуется, выглядит инородно. Toast —
 * стилизованный, неблокирующий, авто-исчезает. Вызывается откуда угодно:
 *   import { toast } from '../store/toast';
 *   toast.success(t('courses.alert_success'));
 *   toast.error(t('courses.alert_error'));
 */
import { create } from 'zustand';
import WebApp from '@twa-dev/sdk';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (type: ToastType, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    // Авто-дисмисс 3.2с
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 3200);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Хелпер с хаптиком — удобный вызов без хука */
export const toast = {
  success(message: string) {
    WebApp.HapticFeedback?.notificationOccurred('success');
    useToastStore.getState().push('success', message);
  },
  error(message: string) {
    WebApp.HapticFeedback?.notificationOccurred('error');
    useToastStore.getState().push('error', message);
  },
  info(message: string) {
    useToastStore.getState().push('info', message);
  },
};
