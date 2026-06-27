/**
 * AdminHr — кадры и зарплата (ADMIN / SUPER_ADMIN).
 * Сотрудники + авто-расчёт зарплаты за месяц. Route: /admin/hr
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useBackButton } from '../../hooks/useBackButton';
import { formatUzs } from '../../lib/money';
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  usePayrollRuns,
  usePayrollRun,
  useGeneratePayroll,
  useFinalizePayroll,
  type Employee,
  type EmploymentType,
  type SalaryType,
} from '../../api/hr';

const EMP_TYPES: EmploymentType[] = ['STAFF', 'SELF_EMPLOYED'];
const SALARY_TYPES: SalaryType[] = ['FIXED', 'PER_LESSON', 'REVENUE_SHARE'];

type Draft = {
  id?: string;
  telegram_username: string;
  employment_type: EmploymentType;
  salary_type: SalaryType;
  rate_uzs: number;
  rate_percent: number;
  is_active: boolean;
  note: string;
};

const EMPTY: Draft = {
  telegram_username: '',
  employment_type: 'STAFF',
  salary_type: 'PER_LESSON',
  rate_uzs: 0,
  rate_percent: 0,
  is_active: true,
  note: '',
};

function empName(e: Employee) {
  return `${e.user.first_name}${e.user.last_name ? ' ' + e.user.last_name : ''}`;
}

export function AdminHrPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'employees' | 'payroll'>('employees');

  useBackButton(() => navigate('/admin'));

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      <h1 className="mb-1 text-xl font-bold">👔 {t('admin.hr.title')}</h1>
      <p className="text-tg-hint mb-4 text-sm">{t('admin.hr.desc')}</p>

      <div className="bg-surface border-hairline mb-4 flex rounded-2xl border p-1">
        {(['employees', 'payroll'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`press flex-1 rounded-xl py-2 text-sm font-medium ${
              tab === id ? 'bg-brand/25 text-brand' : 'text-faint'
            }`}
          >
            {t(`admin.hr.tab_${id}`)}
          </button>
        ))}
      </div>

      {tab === 'employees' ? <EmployeesTab /> : <PayrollTab />}
    </div>
  );
}

// ─── Employees ───────────────────────────────────────────────────────────────

function EmployeesTab() {
  const { t } = useTranslation();
  const { data: list, isLoading } = useEmployees();
  const createMut = useCreateEmployee();
  const updateMut = useUpdateEmployee();
  const deleteMut = useDeleteEmployee();
  const [draft, setDraft] = useState<Draft | null>(null);

  const saving = createMut.isPending || updateMut.isPending;

  const rateLabel = (s: SalaryType) =>
    s === 'REVENUE_SHARE' ? t('admin.hr.rate_percent') : t('admin.hr.rate_uzs');

  const handleSave = () => {
    if (!draft) return;
    if (!draft.id && !draft.telegram_username.trim()) {
      WebApp.showAlert(t('admin.hr.emp_username_req'));
      return;
    }
    const payload = {
      employment_type: draft.employment_type,
      salary_type: draft.salary_type,
      rate_uzs: draft.rate_uzs,
      rate_percent: draft.rate_percent,
      is_active: draft.is_active,
      note: draft.note.trim(),
    };
    const onDone = {
      onSuccess: () => setDraft(null),
      onError: (e: unknown) =>
        WebApp.showAlert(e instanceof Error ? e.message : t('admin.hr.save_error')),
    };
    if (draft.id) updateMut.mutate({ id: draft.id, ...payload }, onDone);
    else
      createMut.mutate({ ...payload, telegram_username: draft.telegram_username.trim() }, onDone);
  };

  const handleDelete = () => {
    if (!draft?.id) return;
    WebApp.showConfirm(t('admin.hr.delete_confirm'), (ok) => {
      if (ok && draft.id) deleteMut.mutate(draft.id, { onSuccess: () => setDraft(null) });
    });
  };

  return (
    <div>
      <button
        onClick={() => setDraft({ ...EMPTY })}
        className="glass-btn press mb-3 w-full rounded-xl py-2.5 text-sm font-semibold"
      >
        + {t('admin.hr.add')}
      </button>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
        </div>
      ) : !list?.length ? (
        <p className="text-tg-hint py-10 text-center text-sm">{t('admin.hr.empty_emp')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((e) => (
            <button
              key={e.id}
              onClick={() =>
                setDraft({
                  id: e.id,
                  telegram_username: e.user.telegram_username ?? '',
                  employment_type: e.employment_type,
                  salary_type: e.salary_type,
                  rate_uzs: e.rate_uzs,
                  rate_percent: e.rate_percent,
                  is_active: e.is_active,
                  note: e.note ?? '',
                })
              }
              className="glass-card press flex items-center justify-between gap-3 rounded-2xl p-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {empName(e)}{' '}
                  {!e.is_active && (
                    <span className="text-faint text-xs">({t('admin.hr.inactive')})</span>
                  )}
                </p>
                <p className="text-tg-hint text-xs">
                  {t(`admin.hr.type_${e.employment_type === 'STAFF' ? 'staff' : 'self'}`)} ·{' '}
                  {t(`admin.hr.salary_${e.salary_type.toLowerCase()}`)}
                </p>
              </div>
              <span className="text-brand shrink-0 text-sm font-bold">
                {e.salary_type === 'REVENUE_SHARE' ? `${e.rate_percent}%` : formatUzs(e.rate_uzs)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Edit sheet */}
      {draft && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm"
          onClick={(ev) => ev.target === ev.currentTarget && setDraft(null)}
        >
          <div
            className="glass-card max-h-[90vh] overflow-y-auto rounded-t-3xl p-6"
            style={{
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              background: 'var(--secondary-bg)',
            }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="mb-4 text-base font-bold">
              {draft.id ? t('admin.hr.edit') : t('admin.hr.add')}
            </h3>

            <div className="flex flex-col gap-3">
              {!draft.id && (
                <div>
                  <label className="text-tg-hint mb-1 block text-xs font-medium">
                    {t('admin.hr.emp_username')}
                  </label>
                  <input
                    value={draft.telegram_username}
                    onChange={(e) => setDraft({ ...draft, telegram_username: e.target.value })}
                    className="input"
                    placeholder="@username"
                  />
                </div>
              )}

              <Picker
                label={t('admin.hr.f_employment')}
                value={draft.employment_type}
                options={EMP_TYPES}
                labelFor={(v) => t(`admin.hr.type_${v === 'STAFF' ? 'staff' : 'self'}`)}
                onPick={(v) => setDraft({ ...draft, employment_type: v })}
              />

              <Picker
                label={t('admin.hr.f_salary')}
                value={draft.salary_type}
                options={SALARY_TYPES}
                labelFor={(v) => t(`admin.hr.salary_${v.toLowerCase()}`)}
                onPick={(v) => setDraft({ ...draft, salary_type: v })}
              />

              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {rateLabel(draft.salary_type)}
                </label>
                {draft.salary_type === 'REVENUE_SHARE' ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={draft.rate_percent}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        rate_percent: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                      })
                    }
                    className="input"
                  />
                ) : (
                  <input
                    type="number"
                    min={0}
                    value={draft.rate_uzs}
                    onChange={(e) =>
                      setDraft({ ...draft, rate_uzs: Math.max(0, Number(e.target.value) || 0) })
                    }
                    className="input"
                  />
                )}
              </div>

              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {t('admin.hr.f_note')}
                </label>
                <input
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  className="input"
                />
              </div>

              <label className="flex items-center justify-between py-1">
                <span className="text-sm font-medium">{t('admin.hr.f_active')}</span>
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-5 w-5 accent-[#6366f1]"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              {draft.id && (
                <button
                  onClick={handleDelete}
                  disabled={deleteMut.isPending}
                  className="bg-danger/15 text-danger border-danger/30 press rounded-2xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {t('admin.hr.delete')}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="glass-btn press flex-1 rounded-2xl py-3 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? t('admin.hr.saving') : t('admin.hr.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Picker<T extends string>({
  label,
  value,
  options,
  labelFor,
  onPick,
}: {
  label: string;
  value: T;
  options: T[];
  labelFor: (v: T) => string;
  onPick: (v: T) => void;
}) {
  return (
    <div>
      <label className="text-tg-hint mb-1 block text-xs font-medium">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onPick(o)}
            className="press rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{
              background: value === o ? 'var(--surface-2)' : 'transparent',
              border: `2px solid ${value === o ? '#6366f1' : 'var(--hairline)'}`,
            }}
          >
            {labelFor(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Payroll ─────────────────────────────────────────────────────────────────

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function PayrollTab() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(currentPeriod());
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const { data: runs } = usePayrollRuns();
  const { data: run } = usePayrollRun(openRunId);
  const generate = useGeneratePayroll();
  const finalize = useFinalizePayroll();

  const handleGenerate = () => {
    generate.mutate(period, {
      onSuccess: (r) => setOpenRunId(r.id),
      onError: (e) => WebApp.showAlert(e instanceof Error ? e.message : t('admin.hr.save_error')),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Generate */}
      <div className="bg-surface border-hairline rounded-2xl border p-4">
        <label className="text-tg-hint mb-1 block text-xs font-medium">
          {t('admin.hr.period')}
        </label>
        <div className="flex gap-2">
          <input
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="YYYY-MM"
            className="input flex-1"
          />
          <button
            onClick={handleGenerate}
            disabled={generate.isPending}
            className="glass-btn press rounded-xl px-4 text-sm font-semibold disabled:opacity-60"
          >
            {generate.isPending ? '...' : t('admin.hr.generate')}
          </button>
        </div>
      </div>

      {/* Run detail */}
      {run && (
        <div className="bg-surface border-hairline rounded-2xl border p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">{run.period}</p>
              <p className="text-faint text-xs">
                {run.status === 'FINALIZED' ? t('admin.hr.finalized') : t('admin.hr.draft')}
              </p>
            </div>
            {run.status === 'DRAFT' && (
              <button
                onClick={() =>
                  WebApp.showConfirm(t('admin.hr.finalize_confirm'), (ok) => {
                    if (ok) finalize.mutate(run.id);
                  })
                }
                disabled={finalize.isPending}
                className="bg-ok/15 text-ok border-ok/30 press rounded-xl border px-3 py-1.5 text-xs font-semibold"
              >
                {t('admin.hr.finalize')}
              </button>
            )}
          </div>

          {/* Totals */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <Total label={t('admin.hr.total_gross')} value={formatUzs(run.total_gross_uzs)} />
            <Total label={t('admin.hr.total_net')} value={formatUzs(run.total_net_uzs)} />
          </div>

          {/* Payslips */}
          <div className="flex flex-col gap-2">
            {run.payslips.map((p) => (
              <div key={p.id} className="bg-surface-2 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {p.employee.user.first_name} {p.employee.user.last_name ?? ''}
                  </p>
                  <p className="text-ok text-sm font-bold">{formatUzs(p.net_uzs)}</p>
                </div>
                <p className="text-faint mt-0.5 text-xs">
                  {t(`admin.hr.salary_${p.employee.salary_type.toLowerCase()}`)}
                  {p.lessons_count > 0 && ` · ${t('admin.hr.lessons_n', { n: p.lessons_count })}`}
                  {' · '}
                  {t('admin.hr.gross')}: {formatUzs(p.gross_uzs)}
                  {p.ndfl_uzs > 0 && ` · ${t('admin.hr.ndfl')}: ${formatUzs(p.ndfl_uzs)}`}
                  {p.social_uzs > 0 && ` · ${t('admin.hr.social')}: ${formatUzs(p.social_uzs)}`}
                </p>
              </div>
            ))}
            {run.payslips.length === 0 && (
              <p className="text-tg-hint py-4 text-center text-sm">{t('admin.hr.empty_emp')}</p>
            )}
          </div>
        </div>
      )}

      {/* Past runs */}
      {runs && runs.length > 0 && (
        <div>
          <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
            {t('admin.hr.history')}
          </p>
          <div className="flex flex-col gap-2">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => setOpenRunId(r.id)}
                className="glass-card press flex items-center justify-between rounded-xl p-3 text-left"
              >
                <span className="text-sm font-semibold">{r.period}</span>
                <span className="flex items-center gap-2">
                  <span className="text-ok text-sm font-bold">{formatUzs(r.total_net_uzs)}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      background:
                        r.status === 'FINALIZED' ? 'rgba(16,185,129,0.15)' : 'var(--surface-2)',
                      color: r.status === 'FINALIZED' ? '#10B981' : 'var(--faint)',
                    }}
                  >
                    {r.status === 'FINALIZED' ? t('admin.hr.finalized') : t('admin.hr.draft')}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-2 rounded-xl p-3">
      <p className="text-faint text-xs">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}
