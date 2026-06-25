/**
 * AdminAnalytics — аналитика: выручка, студенты, воронка записей.
 * Route: /admin/analytics  (ADMIN+ only)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '../../hooks/useBackButton';
import i18n from '../../lib/i18n';

import {
  useAnalyticsRevenue,
  useAnalyticsStudents,
  useAnalyticsEnrollments,
} from '../../api/admin';
import { formatUzs } from '../../lib/money';

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────

function BarChart({
  data,
  color,
  formatValue,
  height = 120,
}: {
  data: { label: string; value: number }[];
  color: string;
  formatValue: (v: number) => string;
  height?: number;
}) {
  const { t } = useTranslation();
  if (!data.length)
    return (
      <p className="py-4 text-center text-xs" style={{ color: 'var(--faint)' }}>
        {t('admin.analytics.no_data')}
      </p>
    );

  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.floor(100 / data.length);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        width={Math.max(data.length * 44, 300)}
        height={height + 32}
        style={{ display: 'block', minWidth: '100%' }}
      >
        {data.map((d, i) => {
          const barH = max > 0 ? Math.round((d.value / max) * height) : 0;
          const x = i * (100 / data.length) + '%';
          const barX = i * (100 / data.length) + 1 + '%';
          return (
            <g key={d.label}>
              {/* Bar */}
              <rect
                x={barX}
                y={height - barH}
                width={`${barW - 2}%`}
                height={barH}
                rx={4}
                fill={color}
                opacity={0.85}
              />
              {/* Value above bar */}
              {d.value > 0 && (
                <text
                  x={`${i * (100 / data.length) + barW / 2}%`}
                  y={height - barH - 4}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.7)"
                  fontSize={9}
                >
                  {formatValue(d.value)}
                </text>
              )}
              {/* Label below */}
              <text
                x={`${i * (100 / data.length) + barW / 2}%`}
                y={height + 18}
                textAnchor="middle"
                fill="rgba(255,255,255,0.35)"
                fontSize={9}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function shortMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const date = new Date(parseInt(y ?? '2024'), parseInt(m ?? '1', 10) - 1, 1);
  return date.toLocaleDateString(i18n.language, { month: 'short' });
}

function shortUzs(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

// ── Revenue section ───────────────────────────────────────────────────────────

function RevenueSection({ months }: { months: number }) {
  const { t } = useTranslation();
  const { data, isLoading } = useAnalyticsRevenue(months);

  const total = data?.reduce((s, d) => s + d.amount_uzs, 0) ?? 0;
  const chartData = (data ?? []).map((d) => ({ label: shortMonth(d.month), value: d.amount_uzs }));

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div>
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'var(--faint)' }}
          >
            {t('admin.analytics.revenue')}
          </p>
          <p className="mt-0.5 text-xl font-bold" style={{ color: '#10B981' }}>
            {formatUzs(total)}
          </p>
          <p className="text-xs" style={{ color: 'var(--faint)' }}>
            {t('admin.analytics.revenue_for', { n: months })}
          </p>
        </div>
      </div>
      {isLoading ? (
        <div className="skeleton h-20 rounded-xl" />
      ) : (
        <BarChart data={chartData} color="#10B981" formatValue={shortUzs} />
      )}
    </div>
  );
}

// ── Students section ──────────────────────────────────────────────────────────

function StudentsSection({ months }: { months: number }) {
  const { t } = useTranslation();
  const { data, isLoading } = useAnalyticsStudents(months);

  const total = data?.reduce((s, d) => s + d.count, 0) ?? 0;
  const chartData = (data ?? []).map((d) => ({ label: shortMonth(d.month), value: d.count }));

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}
    >
      <div className="mb-3">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--faint)' }}
        >
          {t('admin.analytics.new_students')}
        </p>
        <p className="mt-0.5 text-xl font-bold" style={{ color: '#6C5CE7' }}>
          {total}
        </p>
        <p className="text-xs" style={{ color: 'var(--faint)' }}>
          {t('admin.analytics.revenue_for', { n: months })}
        </p>
      </div>
      {isLoading ? (
        <div className="skeleton h-20 rounded-xl" />
      ) : (
        <BarChart data={chartData} color="#6C5CE7" formatValue={(v) => String(v)} />
      )}
    </div>
  );
}

// ── Enrollments section ───────────────────────────────────────────────────────

function EnrollmentsSection() {
  const { t } = useTranslation();
  const { data, isLoading } = useAnalyticsEnrollments();

  if (isLoading) return <div className="skeleton h-32 rounded-2xl" />;
  if (!data) return null;

  const { funnel, by_month } = data;
  const total = funnel.pending + funnel.active + funnel.dropped;
  const chartData = by_month.map((d) => ({ label: shortMonth(d.month), value: d.count }));

  const funnelItems = [
    { label: t('admin.analytics.funnel_active'), value: funnel.active, color: '#10B981' },
    { label: t('admin.analytics.funnel_pending'), value: funnel.pending, color: '#F59E0B' },
    { label: t('admin.analytics.funnel_dropped'), value: funnel.dropped, color: '#EF4444' },
  ];

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)' }}
    >
      <p
        className="mb-3 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--faint)' }}
      >
        {t('admin.analytics.enrollments')}
      </p>

      {/* Funnel */}
      <div className="mb-4 flex gap-2">
        {funnelItems.map((item) => (
          <div
            key={item.label}
            className="flex-1 rounded-xl p-3 text-center"
            style={{ background: `${item.color}14` }}
          >
            <p className="text-lg font-bold" style={{ color: item.color }}>
              {item.value}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--faint)' }}>
              {item.label}
            </p>
            {total > 0 && (
              <p className="text-[10px] font-semibold" style={{ color: item.color }}>
                {Math.round((item.value / total) * 100)}%
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Bar chart by month */}
      {chartData.length > 0 && (
        <>
          <p className="mb-2 text-xs" style={{ color: 'var(--faint)' }}>
            {t('admin.analytics.by_month')}
          </p>
          <BarChart data={chartData} color="#3B82F6" formatValue={(v) => String(v)} height={80} />
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [months, setMonths] = useState(6);

  const PERIOD_OPTIONS = [
    { label: '3', value: 3 },
    { label: '6', value: 6 },
    { label: '12', value: 12 },
  ];

  useBackButton(() => navigate('/admin'));

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass px-4 pb-4 pt-6" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">📊 {t('admin.analytics.title')}</h1>
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setMonths(opt.value)}
                className="press rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: months === opt.value ? '#6C5CE7' : 'var(--surface-2)',
                  color: months === opt.value ? '#fff' : 'var(--surface-2)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stagger flex flex-col gap-4 px-4 py-4">
        <RevenueSection months={months} />
        <StudentsSection months={months} />
        <EnrollmentsSection />
      </div>
    </div>
  );
}
