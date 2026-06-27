/**
 * AdminFinance — финансовая аналитика.
 * ADMIN / SUPER_ADMIN.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';
import i18n from '../../lib/i18n';

import {
  useAdminDashboard,
  useAnalyticsRevenue,
  useAnalyticsStudents,
  useAdminPayments,
  useRefundPayment,
  useConfirmCashPayment,
  type AdminPayment,
} from '../../api/admin';
import { apiClient } from '../../api/client';
import { formatUzs } from '../../lib/money';

async function exportPayments(onError: () => void) {
  try {
    const res = await apiClient.get<Blob>('/admin/payments/export', { responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    WebApp.HapticFeedback.notificationOccurred('success');
  } catch {
    onError();
  }
}

export function AdminFinancePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useBackButton(() => navigate('/admin'));

  const { data: widgets } = useAdminDashboard();
  const { data: revenue, isLoading: revLoading } = useAnalyticsRevenue(6);
  const { data: students, isLoading: stuLoading } = useAnalyticsStudents(6);

  const totalRevenue6m = revenue?.reduce((s, r) => s + r.amount_uzs, 0) ?? 0;
  const maxRevenue = Math.max(...(revenue?.map((r) => r.amount_uzs) ?? [1]));
  const maxStudents = Math.max(...(students?.map((s) => s.count) ?? [1]));

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">💰 {t('admin.finance.title')}</h1>
          <p className="text-tg-hint mt-0.5 text-sm">{t('admin.finance.analytics')}</p>
        </div>
        <button
          onClick={() => exportPayments(() => WebApp.showAlert(t('admin.finance.export_error')))}
          className="bg-ok/15 text-ok press rounded-xl px-3 py-1.5 text-xs font-semibold"
        >
          📥 CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="stagger mb-5 grid grid-cols-2 gap-3">
        <SummaryCard
          label={t('admin.finance.revenue_month')}
          value={formatUzs(Math.round((widgets?.revenue_this_month ?? 0) / 100))}
          emoji="💵"
          color="#10B981"
        />
        <SummaryCard
          label={t('admin.finance.revenue_6m')}
          value={formatUzs(totalRevenue6m)}
          emoji="📈"
          color="#6366f1"
        />
        <SummaryCard
          label={t('admin.finance.active_enrollments')}
          value={String(widgets?.active_enrollments ?? 0)}
          emoji="📚"
          color="#3B82F6"
        />
        <SummaryCard
          label={t('admin.finance.total_students')}
          value={String(widgets?.total_students ?? 0)}
          emoji="🎓"
          color="#818cf8"
        />
      </div>

      {/* Revenue chart */}
      <div className="glass-card mb-4 rounded-2xl p-4">
        <p className="mb-4 text-sm font-semibold">{t('admin.finance.revenue_by_month')}</p>
        {revLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="border-brand/30 border-t-brand h-6 w-6 animate-spin rounded-full border-4" />
          </div>
        ) : revenue && revenue.length > 0 ? (
          <div className="flex h-32 items-end gap-2">
            {revenue.map((r) => {
              const pct = maxRevenue > 0 ? (r.amount_uzs / maxRevenue) * 100 : 0;
              return (
                <div key={r.month} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-lg transition-all duration-700"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                      background: 'linear-gradient(180deg,#10B981,#059669)',
                    }}
                  />
                  <span className="text-tg-hint text-[9px]">{r.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-tg-hint py-8 text-center text-sm">{t('admin.finance.no_data')}</p>
        )}
      </div>

      {/* Revenue table */}
      {revenue && revenue.length > 0 && (
        <div className="glass-card mb-4 overflow-hidden rounded-2xl">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-sm font-semibold">{t('admin.finance.detail_by_month')}</p>
          </div>
          {[...revenue].reverse().map((r, i) => (
            <div
              key={r.month}
              className={`flex items-center justify-between px-4 py-3 ${
                i < revenue.length - 1 ? 'border-b border-white/[0.04]' : ''
              }`}
            >
              <span className="text-sm">{formatMonth(r.month)}</span>
              <span className="text-ok text-sm font-semibold">{formatUzs(r.amount_uzs)}</span>
            </div>
          ))}
        </div>
      )}

      {/* New students chart */}
      <div className="glass-card rounded-2xl p-4">
        <p className="mb-4 text-sm font-semibold">{t('admin.finance.students_by_month')}</p>
        {stuLoading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="border-brand/30 border-t-brand h-5 w-5 animate-spin rounded-full border-4" />
          </div>
        ) : students && students.length > 0 ? (
          <div className="flex h-24 items-end gap-2">
            {students.map((s) => {
              const pct = maxStudents > 0 ? (s.count / maxStudents) * 100 : 0;
              return (
                <div key={s.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-tg-hint text-[9px]">{s.count}</span>
                  <div
                    className="w-full rounded-t-lg transition-all duration-700"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                      background: 'linear-gradient(180deg,#6366f1,#4F46E5)',
                    }}
                  />
                  <span className="text-tg-hint text-[9px]">{s.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-tg-hint py-6 text-center text-sm">{t('admin.finance.no_data')}</p>
        )}
      </div>

      {/* Платежи + возврат */}
      <PaymentsSection />
    </div>
  );
}

const PAY_STATUS_COLOR: Record<string, string> = {
  PAID: '#10B981',
  PENDING: '#F59E0B',
  REFUNDED: '#818cf8',
  CANCELLED: '#6B7280',
  FAILED: '#EF4444',
  EXPIRED: '#6B7280',
  AUTHORIZED: '#3B82F6',
};

function PaymentsSection() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useAdminPayments();
  const refund = useRefundPayment();
  const confirmCash = useConfirmCashPayment();

  const handleConfirmCash = (p: AdminPayment) => {
    WebApp.showConfirm(t('admin.finance.cash_confirm'), (ok) => {
      if (!ok) return;
      confirmCash.mutate(p.id, {
        onSuccess: () => WebApp.showAlert(t('admin.finance.cash_done')),
        onError: () => WebApp.showAlert(t('admin.finance.cash_error')),
      });
    });
  };

  const handleRefund = (p: AdminPayment) => {
    WebApp.showConfirm(t('admin.finance.refund_confirm'), (ok) => {
      if (!ok) return;
      refund.mutate(
        { id: p.id },
        {
          onSuccess: (res) => {
            WebApp.showAlert(
              res.provider_action_required
                ? t('admin.finance.refund_done_cabinet')
                : t('admin.finance.refund_done'),
            );
          },
          onError: () => WebApp.showAlert(t('admin.finance.refund_error')),
        },
      );
    });
  };

  return (
    <div className="glass-card mt-4 overflow-hidden rounded-2xl">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="text-sm font-semibold">{t('admin.finance.payments')}</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="border-brand/30 border-t-brand h-6 w-6 animate-spin rounded-full border-4" />
        </div>
      ) : !data?.items.length ? (
        <p className="text-tg-hint py-8 text-center text-sm">{t('admin.finance.no_data')}</p>
      ) : (
        <div className="flex flex-col">
          {data.items.map((p, i) => {
            const color = PAY_STATUS_COLOR[p.status] ?? '#6B7280';
            const name = `${p.user.first_name}${p.user.last_name ? ' ' + p.user.last_name : ''}`;
            const amount = formatUzs(Math.round(Number(p.amount_tiyin) / 100));
            return (
              <div
                key={p.id}
                className={`px-4 py-3 ${i < data.items.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-tg-hint truncate text-xs">
                      {p.class?.title ?? '—'} · {p.provider} ·{' '}
                      {new Date(p.created_at).toLocaleDateString(i18n.language)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold">{amount}</p>
                    <span className="text-xs font-semibold" style={{ color }}>
                      {p.status}
                    </span>
                  </div>
                </div>
                {p.provider === 'CASH' && p.status === 'PENDING' && (
                  <button
                    onClick={() => handleConfirmCash(p)}
                    disabled={confirmCash.isPending}
                    className="bg-ok/10 text-ok border-ok/25 press mt-2 w-full rounded-xl border py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    💵 {t('admin.finance.cash_confirm_btn')}
                  </button>
                )}
                {p.status === 'PAID' && (
                  <button
                    onClick={() => handleRefund(p)}
                    disabled={refund.isPending}
                    className="bg-danger/10 text-danger border-danger/25 press mt-2 w-full rounded-xl border py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    ↩️ {t('admin.finance.refund')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  emoji,
  color,
}: {
  label: string;
  value: string;
  emoji: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: `${color}12`, border: `1px solid ${color}28` }}
    >
      <div className="mb-1 text-xl">{emoji}</div>
      <div className="text-sm font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-tg-hint mt-0.5 text-xs">{label}</div>
    </div>
  );
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-');
  const date = new Date(parseInt(year ?? '2024'), parseInt(month ?? '1', 10) - 1, 1);
  return date.toLocaleDateString(i18n.language, { month: 'short', year: '2-digit' });
}
