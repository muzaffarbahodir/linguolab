'use client';

/**
 * AnalyticsPage — дашборд аналитики LinguoLab.
 * Client Component: интерактивные recharts + переключатель периода.
 *
 * Секции:
 *  1. KPI-карточки: выручка за текущий месяц, всего студентов, активных записей
 *  2. График выручки — BarChart по месяцам (UZS)
 *  3. График новых студентов — LineChart по месяцам
 *  4. Воронка записей — BarChart (PENDING/ACTIVE/DROPPED по месяцам)
 *  5. Пирог статусов — PieChart текущее распределение enrollment status
 *
 * Данные: /api/proxy/analytics?type=revenue|students|enrollments
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ─── Типы ─────────────────────────────────────────────────────────────────────

interface RevenuePoint {
  month: string;
  amount_uzs: number;
}

interface StudentPoint {
  month: string;
  count: number;
}

interface EnrollmentStatus {
  status: string;
  count: number;
}

interface FunnelPoint {
  month: string;
  pending: number;
  active: number;
  dropped: number;
}

interface EnrollmentData {
  by_status: EnrollmentStatus[];
  funnel_monthly: FunnelPoint[];
}

// ─── Цвета ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  ACTIVE: '#22c55e',
  DROPPED: '#94a3b8',
};

const CHART_COLORS = {
  revenue: '#3b82f6',
  students: '#8b5cf6',
  pending: '#f59e0b',
  active: '#22c55e',
  dropped: '#94a3b8',
};

// ─── Утилиты ──────────────────────────────────────────────────────────────────

/** Форматирует YYYY-MM → Мес YYYY (ru) */
function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  if (!year || !month) return ym;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
}

/** Форматирует число в сокращённый вид: 1 500 000 → 1.5M, 150 000 → 150K */
function formatUzs(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

// ─── Компоненты ───────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-1 text-2xl">{icon}</div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{children}</h2>
  );
}

function LoadingChart() {
  return (
    <div className="flex h-52 items-center justify-center rounded-xl border border-gray-100 bg-white">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-400 border-t-transparent" />
    </div>
  );
}

// ─── Главная страница ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [months, setMonths] = useState(12);
  const [revenue, setRevenue] = useState<RevenuePoint[] | null>(null);
  const [students, setStudents] = useState<StudentPoint[] | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');

    void (async () => {
      try {
        const [revRes, stuRes, enrollRes] = await Promise.all([
          fetch(`/api/proxy/analytics?type=revenue&months=${months}`),
          fetch(`/api/proxy/analytics?type=students&months=${months}`),
          fetch(`/api/proxy/analytics?type=enrollments`),
        ]);

        if (!revRes.ok || !stuRes.ok || !enrollRes.ok) {
          setError('Ошибка загрузки данных');
          return;
        }

        const [revData, stuData, enrollData] = await Promise.all([
          revRes.json() as Promise<RevenuePoint[]>,
          stuRes.json() as Promise<StudentPoint[]>,
          enrollRes.json() as Promise<EnrollmentData>,
        ]);

        setRevenue(revData.map((r) => ({ ...r, month: formatMonth(r.month) })));
        setStudents(stuData.map((s) => ({ ...s, month: formatMonth(s.month) })));
        setEnrollments(enrollData);
      } catch {
        setError('Сетевая ошибка');
      } finally {
        setLoading(false);
      }
    })();
  }, [months]);

  // KPI: сумма выручки за все месяцы + последний месяц
  const totalRevenue = revenue?.reduce((sum, r) => sum + r.amount_uzs, 0) ?? 0;
  const lastMonthRevenue = revenue?.at(-1)?.amount_uzs ?? 0;
  const totalNewStudents = students?.reduce((sum, s) => sum + s.count, 0) ?? 0;
  const activeEnrollments = enrollments?.by_status.find((s) => s.status === 'ACTIVE')?.count ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Аналитика</h1>
          <p className="mt-1 text-sm text-gray-500">Выручка, студенты, воронка записей</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          >
            <option value={3}>3 месяца</option>
            <option value={6}>6 месяцев</option>
            <option value={12}>12 месяцев</option>
          </select>
          <Link href="/" className="text-sm text-blue-500 hover:underline">
            ← Дашборд
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon="💰"
          label={`Выручка (${months} мес.)`}
          value={`${formatUzs(totalRevenue)} сум`}
          sub={`Последний мес: ${formatUzs(lastMonthRevenue)} сум`}
        />
        <KpiCard
          icon="👥"
          label={`Новые студенты (${months} мес.)`}
          value={String(totalNewStudents)}
          sub="Зарегистрированных"
        />
        <KpiCard
          icon="✅"
          label="Активных записей"
          value={String(activeEnrollments)}
          sub="Всего в системе"
        />
        <KpiCard
          icon="🔄"
          label="Ожидает подтверждения"
          value={String(enrollments?.by_status.find((s) => s.status === 'PENDING')?.count ?? 0)}
          sub="PENDING enrollments"
        />
      </div>

      {/* Revenue Chart */}
      <div className="mb-8">
        <SectionTitle>Выручка по месяцам (UZS)</SectionTitle>
        {loading || !revenue ? (
          <LoadingChart />
        ) : revenue.length === 0 ? (
          <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
            Нет данных о выручке за выбранный период
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenue} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatUzs} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) =>
                    [`${Number(value).toLocaleString('ru-RU')} сум`, 'Выручка'] as [string, string]
                  }
                />
                <Bar dataKey="amount_uzs" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Students Chart */}
      <div className="mb-8">
        <SectionTitle>Новые студенты по месяцам</SectionTitle>
        {loading || !students ? (
          <LoadingChart />
        ) : students.length === 0 ? (
          <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
            Нет данных за выбранный период
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={students} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value) => [Number(value), 'Новых студентов'] as [number, string]}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke={CHART_COLORS.students}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Enrollment Funnel + Pie */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Funnel BarChart */}
        <div>
          <SectionTitle>Воронка записей (6 месяцев)</SectionTitle>
          {loading || !enrollments ? (
            <LoadingChart />
          ) : enrollments.funnel_monthly.length === 0 ? (
            <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
              Нет данных
            </div>
          ) : (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={enrollments.funnel_monthly.map((f) => ({
                    ...f,
                    month: formatMonth(f.month),
                  }))}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="pending" name="Ожидает" fill={CHART_COLORS.pending} stackId="a" />
                  <Bar dataKey="active" name="Активна" fill={CHART_COLORS.active} stackId="a" />
                  <Bar
                    dataKey="dropped"
                    name="Отменена"
                    fill={CHART_COLORS.dropped}
                    stackId="a"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Status PieChart */}
        <div>
          <SectionTitle>Распределение записей</SectionTitle>
          {loading || !enrollments ? (
            <LoadingChart />
          ) : (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={enrollments.by_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${String(name)}: ${String(value)}`}
                  >
                    {enrollments.by_status.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#cbd5e1'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="mt-2 flex justify-center gap-4">
                {enrollments.by_status.map((s) => (
                  <div key={s.status} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: STATUS_COLORS[s.status] ?? '#cbd5e1' }}
                    />
                    {s.status === 'PENDING'
                      ? 'Ожидает'
                      : s.status === 'ACTIVE'
                        ? 'Активна'
                        : 'Отменена'}{' '}
                    ({s.count})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
