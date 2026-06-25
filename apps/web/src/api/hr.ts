import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export type EmploymentType = 'STAFF' | 'SELF_EMPLOYED';
export type SalaryType = 'FIXED' | 'PER_LESSON' | 'REVENUE_SHARE';
export type PayrollStatus = 'DRAFT' | 'FINALIZED';

export interface Employee {
  id: string;
  user_id: string;
  employment_type: EmploymentType;
  salary_type: SalaryType;
  rate_uzs: number;
  rate_percent: number;
  is_active: boolean;
  note: string | null;
  hired_at: string;
  user: {
    first_name: string;
    last_name: string | null;
    telegram_username: string | null;
    role: string;
  };
}

export interface UpsertEmployeeInput {
  telegram_username?: string;
  employment_type?: EmploymentType;
  salary_type?: SalaryType;
  rate_uzs?: number;
  rate_percent?: number;
  is_active?: boolean;
  note?: string;
}

export interface PayrollRun {
  id: string;
  period: string;
  status: PayrollStatus;
  total_gross_uzs: number;
  total_net_uzs: number;
  created_at: string;
  finalized_at: string | null;
}

export interface Payslip {
  id: string;
  gross_uzs: number;
  lessons_count: number;
  ndfl_uzs: number;
  social_uzs: number;
  net_uzs: number;
  employee: {
    id: string;
    employment_type: EmploymentType;
    salary_type: SalaryType;
    user: { first_name: string; last_name: string | null };
  };
}

export interface PayrollRunDetail extends PayrollRun {
  payslips: Payslip[];
}

// ─── Employees ───────────────────────────────────────────────────────────────

export function useEmployees() {
  return useQuery({
    queryKey: ['hr', 'employees'],
    queryFn: async () => (await apiClient.get<Employee[]>('/hr/employees')).data,
  });
}

function useInvalidateHr() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ['hr'] });
}

export function useCreateEmployee() {
  const inv = useInvalidateHr();
  return useMutation({
    mutationFn: (input: UpsertEmployeeInput) =>
      apiClient.post<Employee>('/hr/employees', input).then((r) => r.data),
    onSuccess: inv,
  });
}

export function useUpdateEmployee() {
  const inv = useInvalidateHr();
  return useMutation({
    mutationFn: ({ id, ...input }: UpsertEmployeeInput & { id: string }) =>
      apiClient.patch<Employee>(`/hr/employees/${id}`, input).then((r) => r.data),
    onSuccess: inv,
  });
}

export function useDeleteEmployee() {
  const inv = useInvalidateHr();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/hr/employees/${id}`).then((r) => r.data),
    onSuccess: inv,
  });
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

export function usePayrollRuns() {
  return useQuery({
    queryKey: ['hr', 'runs'],
    queryFn: async () => (await apiClient.get<PayrollRun[]>('/hr/payroll/runs')).data,
  });
}

export function usePayrollRun(id: string | null) {
  return useQuery({
    queryKey: ['hr', 'run', id],
    enabled: !!id,
    queryFn: async () => (await apiClient.get<PayrollRunDetail>(`/hr/payroll/runs/${id}`)).data,
  });
}

export function useGeneratePayroll() {
  const inv = useInvalidateHr();
  return useMutation({
    mutationFn: (period: string) =>
      apiClient.post<PayrollRunDetail>('/hr/payroll/runs', { period }).then((r) => r.data),
    onSuccess: inv,
  });
}

export function useFinalizePayroll() {
  const inv = useInvalidateHr();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/hr/payroll/runs/${id}/finalize`).then((r) => r.data),
    onSuccess: inv,
  });
}
