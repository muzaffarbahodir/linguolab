/**
 * admin.ts — API хуки для панели администратора в TWA.
 * Доступно только ADMIN / SUPER_ADMIN (часть — MANAGER).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
import type { LanguageCategory } from './languages';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Role = 'STUDENT' | 'TEACHER' | 'MANAGER' | 'PARENT' | 'ADMIN' | 'SUPER_ADMIN';

export interface AdminUser {
  id: string;
  telegram_user_id: string;
  telegram_username: string | null;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface DashboardWidgets {
  total_students: number;
  active_enrollments: number;
  total_teachers: number;
  lessons_this_week: number;
  pending_homework: number;
  revenue_this_month: number; // тийины
  pending_users: number;
}

export interface AuditEntry {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  actor?: { first_name: string; last_name: string | null } | null;
}

/** API возвращает { items, total, page, limit, pages } */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface BroadcastResult {
  queued: number;
}

export interface RevenuePoint {
  month: string; // 'YYYY-MM'
  amount_uzs: number;
}

export interface StudentsPoint {
  month: string;
  count: number;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<DashboardWidgets>('/admin/dashboard/widgets');
      return res.data;
    },
    staleTime: 2 * 60 * 1000, // 2 мин — не перезапрашивает при каждом открытии
    placeholderData: {
      total_students: 0,
      active_enrollments: 0,
      total_teachers: 0,
      lessons_this_week: 0,
      pending_homework: 0,
      revenue_this_month: 0,
      pending_users: 0,
    },
  });
}

export interface RecentPayment {
  id: string;
  amount_uzs: number;
  provider: string;
  paid_at: string;
  student: string;
  class_title: string | null;
}

export function useRecentPayments(limit = 8) {
  return useQuery({
    queryKey: ['admin', 'payments', 'recent', limit],
    queryFn: async () =>
      (await apiClient.get<RecentPayment[]>(`/admin/payments/recent?limit=${limit}`)).data,
    staleTime: 30_000,
  });
}

// ─── Users (ADMIN+) ───────────────────────────────────────────────────────────

export function useAdminUsers(page = 1, role?: Role) {
  return useQuery({
    queryKey: ['admin', 'users', page, role],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (role) params.set('role', role);
      const res = await apiClient.get<PaginatedResult<AdminUser>>(`/admin/users?${params}`);
      return res.data;
    },
  });
}

export function usePendingUsers() {
  return useQuery({
    queryKey: ['admin', 'users', 'pending'],
    queryFn: async () => {
      const res = await apiClient.get<AdminUser[]>('/users/pending');
      return res.data;
    },
  });
}

/** Полная карточка пользователя (контакты + поля профиля). */
export interface AdminUserDetail extends AdminUser {
  email: string | null;
  phone: string | null;
  gender: 'MALE' | 'FEMALE' | null;
  birth_date: string | null;
  locale: string;
  preferred_currency: string;
  country: string;
  last_active_at: string;
  enrollments_count: number;
}

export function useAdminUser(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'user', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<AdminUserDetail>(`/admin/users/${id}`);
      return res.data;
    },
  });
}

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role?: Role }) => {
      const res = await apiClient.patch(`/users/${id}/activate`, role ? { role } : {});
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'dashboard'] });
    },
  });
}

export function useChangeUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, role }: { id: string; role: Role }) => {
      const res = await apiClient.patch(`/admin/users/${id}/role`, { role });
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

// ─── Students (MANAGER+) ─────────────────────────────────────────────────────

export function useAdminStudents(page = 1, search?: string) {
  return useQuery({
    queryKey: ['admin', 'students', page, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      const res = await apiClient.get<PaginatedResult<AdminUser>>(`/admin/students?${params}`);
      return res.data;
    },
  });
}

// ─── Broadcast (ADMIN+) ───────────────────────────────────────────────────────

export function useBroadcast() {
  return useMutation({
    mutationFn: async ({ message, target }: { message: string; target: 'all' | string }) => {
      const res = await apiClient.post<BroadcastResult>('/admin/notifications/broadcast', {
        message,
        target,
      });
      return res.data;
    },
  });
}

// ─── Finance analytics (ADMIN+) ───────────────────────────────────────────────

export function useAnalyticsRevenue(months = 12) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'revenue', months],
    queryFn: async () => {
      const res = await apiClient.get<RevenuePoint[]>(`/admin/analytics/revenue?months=${months}`);
      return res.data;
    },
  });
}

export function useAnalyticsStudents(months = 12) {
  return useQuery({
    queryKey: ['admin', 'analytics', 'students', months],
    queryFn: async () => {
      const res = await apiClient.get<StudentsPoint[]>(
        `/admin/analytics/students?months=${months}`,
      );
      return res.data;
    },
  });
}

// ─── Analytics enrollments (ADMIN+) ─────────────────────────────────────────

export interface EnrollmentAnalytics {
  funnel: { pending: number; active: number; dropped: number };
  by_month: { month: string; count: number }[];
}

export function useAnalyticsEnrollments() {
  return useQuery({
    queryKey: ['admin', 'analytics', 'enrollments'],
    queryFn: async () => {
      const res = await apiClient.get<EnrollmentAnalytics>('/admin/analytics/enrollments');
      return res.data;
    },
  });
}

// ─── Teachers (MANAGER+) ─────────────────────────────────────────────────────

export interface AdminTeacher {
  id: string;
  bio: string | null;
  user: {
    id: string;
    first_name: string;
    last_name: string | null;
    telegram_username: string | null;
    avatar_url: string | null;
  };
  avg_rating: number | null;
  classes_count: number;
}

export function useAdminTeachers(page = 1) {
  return useQuery({
    queryKey: ['admin', 'teachers', page],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResult<AdminTeacher>>(
        `/admin/teachers?page=${page}&limit=20`,
      );
      return res.data;
    },
  });
}

export function useCreateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      first_name: string;
      last_name?: string;
      email: string;
      phone?: string;
      bio?: string;
    }) => {
      const res = await apiClient.post('/admin/teachers', dto);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'teachers'] }),
  });
}

export function useUpdateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...dto
    }: {
      id: string;
      bio?: string;
      first_name?: string;
      last_name?: string;
    }) => {
      const res = await apiClient.patch(`/admin/teachers/${id}`, dto);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'teachers'] }),
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/teachers/${id}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'teachers'] }),
  });
}

// ─── Classes (MANAGER+) ──────────────────────────────────────────────────────

export type ClassStatus =
  | 'DRAFT'
  | 'ENROLLMENT_OPEN'
  | 'ACTIVE'
  | 'EXAM'
  | 'COMPLETED'
  | 'CANCELLED';

export interface AdminClass {
  id: string;
  title: string;
  level: string;
  price_uzs: number;
  price_usd: number;
  max_students: number;
  is_active: boolean;
  status: ClassStatus;
  semester_label: string | null;
  enrollment_opens_at: string | null;
  enrollment_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  description: string | null;
  enrolled_count: number;
  schedule_days?: string[];
  schedule_time?: string | null;
  schedule_duration?: number | null;
  language: { id: string; name_ru: string; flag_emoji: string; color: string | null };
  teacher: {
    id: string;
    user: { first_name: string; last_name: string | null };
  };
  _count?: { enrollments: number };
}

export interface ClassRequestItem {
  id: string;
  title: string;
  level: string;
  description: string | null;
  schedule_days: string[];
  schedule_time: string | null;
  schedule_duration: number | null;
  starts_at: string | null;
  ends_at: string | null;
  max_students: number;
  note: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  teacher: {
    id: string;
    user: { id: string; first_name: string; last_name: string | null; avatar_url: string | null };
  };
  language: { id: string; name_ru: string; flag_emoji: string; code: string };
  approved_class: { id: string; title: string; status: string } | null;
}

export function useAdminClasses(page = 1) {
  return useQuery({
    queryKey: ['admin', 'classes', page],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedResult<AdminClass>>(
        `/admin/classes?page=${page}&limit=20`,
      );
      return res.data;
    },
  });
}

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: {
      language_id: string;
      teacher_id: string;
      title: string;
      level: string;
      price_uzs: number;
      price_usd?: number;
      max_students?: number;
      description?: string;
    }) => {
      const res = await apiClient.post('/admin/classes', dto);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'classes'] }),
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...dto
    }: {
      id: string;
      title?: string;
      level?: string;
      price_uzs?: number;
      price_usd?: number;
      max_students?: number;
      description?: string;
      is_active?: boolean;
    }) => {
      const res = await apiClient.patch(`/admin/classes/${id}`, dto);
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'classes'] }),
  });
}

export function useUpdateClassStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ClassStatus }) => {
      const res = await apiClient.patch(`/admin/classes/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'classes'] }),
  });
}

export function useAdminClassRequests(status?: string) {
  return useQuery({
    queryKey: ['admin', 'class-requests', status ?? 'all'],
    queryFn: async () => {
      const params = status ? `?status=${status}` : '';
      const res = await apiClient.get<ClassRequestItem[]>(`/class-requests${params}`);
      return res.data;
    },
  });
}

export function useApproveClassRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...dto
    }: {
      id: string;
      price_uzs: number;
      price_usd: number;
      max_students?: number;
      level?: string;
      schedule_days?: string[];
      schedule_time?: string;
      schedule_duration?: number;
      enrollment_opens_at?: string;
      enrollment_closes_at?: string;
      starts_at?: string;
      ends_at?: string;
      semester_label?: string;
      admin_note?: string;
    }) => {
      const res = await apiClient.patch(`/class-requests/${id}/approve`, dto);
      return res.data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'class-requests'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'classes'] });
    },
  });
}

export function useRejectClassRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, admin_note }: { id: string; admin_note?: string }) => {
      const res = await apiClient.patch(`/class-requests/${id}/reject`, { admin_note });
      return res.data;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'class-requests'] }),
  });
}

export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/admin/classes/${id}`);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'classes'] }),
  });
}

// ─── Payment provider settings (ADMIN+) ──────────────────────────────────────

export interface PaymentProviderConfig {
  provider: string;
  is_enabled: boolean;
  display_order: number;
}

export function usePaymentProviders() {
  return useQuery({
    queryKey: ['admin', 'settings', 'payment-providers'],
    queryFn: async () => {
      const res = await apiClient.get<PaymentProviderConfig[]>('/admin/settings/payment-providers');
      return res.data;
    },
  });
}

export function useUpdatePaymentProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      is_enabled,
      display_order,
    }: {
      provider: string;
      is_enabled?: boolean;
      display_order?: number;
    }) =>
      apiClient
        .patch(`/admin/settings/payment-providers/${provider}`, { is_enabled, display_order })
        .then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'settings'] }),
  });
}

// ─── Referral analytics (MANAGER+) ──────────────────────────────────────────

export interface ReferralStats {
  total: number;
  redeemed: number;
  conversion_pct: number;
  top_referrers: {
    code: string;
    used_count: number;
    bonus_days_granted: number;
    created_at: string;
    referrer: { first_name: string; last_name: string | null; telegram_username: string | null };
  }[];
}

export function useReferralStats() {
  return useQuery({
    queryKey: ['admin', 'referrals', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<ReferralStats>('/referrals/admin/stats');
      return res.data;
    },
  });
}

// ─── Audit (ADMIN+) ───────────────────────────────────────────────────────────

export function useAuditLog(page = 1) {
  return useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: async () => {
      const res = await apiClient.get<{
        items: AuditEntry[];
        total: number;
        page: number;
        pages: number;
      }>(`/admin/audit?page=${page}&limit=20`);
      return res.data;
    },
  });
}

// ─── Languages management (SUPER_ADMIN) ─────────────────────────────────────────

export interface AdminLanguage {
  id: string;
  code: string;
  name_ru: string;
  flag_emoji: string;
  category: LanguageCategory;
  color: string | null;
  image_url: string | null;
  description: string | null;
  duration_label: string | null;
  includes: string[];
  requirements: string[];
  is_active: boolean;
  created_at: string;
}

export interface UpsertLanguageInput {
  code?: string;
  name_ru?: string;
  flag_emoji?: string;
  category?: LanguageCategory;
  color?: string | null;
  image_url?: string | null;
  description?: string | null;
  duration_label?: string | null;
  includes?: string[];
  requirements?: string[];
  is_active?: boolean;
}

export function useAdminLanguages() {
  return useQuery({
    queryKey: ['admin', 'languages'],
    queryFn: async () => {
      const res = await apiClient.get<AdminLanguage[]>('/languages/admin/all');
      return res.data;
    },
  });
}

function useInvalidateLanguages() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['admin', 'languages'] });
    void qc.invalidateQueries({ queryKey: ['languages'] });
  };
}

export function useCreateLanguage() {
  const invalidate = useInvalidateLanguages();
  return useMutation({
    mutationFn: (input: UpsertLanguageInput) =>
      apiClient.post<AdminLanguage>('/languages', input).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useUpdateLanguage() {
  const invalidate = useInvalidateLanguages();
  return useMutation({
    mutationFn: ({ id, ...input }: UpsertLanguageInput & { id: string }) =>
      apiClient.patch<AdminLanguage>(`/languages/${id}`, input).then((r) => r.data),
    onSuccess: invalidate,
  });
}

export function useDeleteLanguage() {
  const invalidate = useInvalidateLanguages();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/languages/${id}`).then((r) => r.data),
    onSuccess: invalidate,
  });
}

// ─── Payments + refund (ADMIN+) ─────────────────────────────────────────────────

export interface AdminPayment {
  id: string;
  amount_tiyin: string;
  vat_amount_tiyin: string;
  provider: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  refund_reason?: string | null;
  user: { first_name: string; last_name: string | null; telegram_username: string | null };
  class: { title: string } | null;
}

export function useAdminPayments(status?: string) {
  return useQuery({
    queryKey: ['admin', 'payments', status ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams({ page: '1', limit: '30' });
      if (status) params.set('status', status);
      const res = await apiClient.get<PaginatedResult<AdminPayment>>(
        `/payments/admin/list?${params}`,
      );
      return res.data;
    },
  });
}

export function useRefundPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient
        .post<{
          ok: boolean;
          status: string;
          provider_action_required: boolean;
          already?: boolean;
        }>(`/payments/admin/${id}/refund`, { reason })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      void qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}

/** Подтверждение наличной оплаты (MANAGER+): CASH PENDING → PAID + запись в курс. */
export function useConfirmCashPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient
        .post<{
          ok: boolean;
          status: string;
          already?: boolean;
        }>(`/payments/admin/${id}/confirm-cash`)
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'payments'] });
      void qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
  });
}
