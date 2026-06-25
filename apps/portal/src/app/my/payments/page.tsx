import { getServerToken } from '../../../lib/server-token';
import { apiFetch } from '../../../lib/api';
import Nav from '../../../components/Nav';

export const revalidate = 0;

interface Payment {
  id: string;
  amount_tiyin: number;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  provider: string;
  created_at: string;
  paid_at: string | null;
  class: { title: string } | null;
}

const STATUS_ICON: Record<string, string> = {
  PAID: '✅',
  PENDING: '⏳',
  FAILED: '❌',
  REFUNDED: '↩️',
};
const STATUS_LABEL: Record<string, string> = {
  PAID: 'Оплачено',
  PENDING: 'Ожидает',
  FAILED: 'Ошибка',
  REFUNDED: 'Возврат',
};

function statusClass(status: string) {
  if (status === 'PAID') return 'glass-option-emerald';
  if (status === 'PENDING') return 'glass-option';
  if (status === 'FAILED') return 'glass-option-red';
  return 'glass-option';
}

function fmtUzs(tiyin: number) {
  return (tiyin / 100).toLocaleString('ru-RU') + ' сум';
}

export default async function PaymentsPage() {
  const token = await getServerToken();

  const res = await apiFetch('/payments/my', token);
  const payments: Payment[] = res.ok ? ((await res.json()) as Payment[]) : [];

  const totalPaid = payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + p.amount_tiyin, 0);

  return (
    <>
      <Nav />
      <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
        {/* Header */}
        <div className="glass-card rounded-3xl px-5 py-5">
          <p
            className="mb-1 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--glass-accent)' }}
          >
            Финансы
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--glass-text)' }}>
            💳 История платежей
          </h1>
          {payments.length > 0 && (
            <p className="mt-0.5 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Итого оплачено:{' '}
              <span className="font-bold" style={{ color: 'var(--glass-accent)' }}>
                {fmtUzs(totalPaid)}
              </span>
            </p>
          )}
        </div>

        {/* Empty */}
        {payments.length === 0 ? (
          <div className="glass rounded-2xl px-4 py-10 text-center">
            <p className="text-2xl">📭</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Платежей пока нет
            </p>
          </div>
        ) : (
          <div className="glass-section overflow-hidden rounded-2xl">
            {payments.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-3.5"
                style={{
                  borderBottom: i < payments.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                }}
              >
                {/* Icon */}
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                  style={{ background: 'var(--glass-green-bg)' }}
                >
                  💳
                </span>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: 'var(--glass-text)' }}>
                    {fmtUzs(p.amount_tiyin)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                    {p.class?.title ?? '—'} · {p.provider} ·{' '}
                    {new Date(p.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className={`${statusClass(p.status)} shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold`}
                >
                  {STATUS_ICON[p.status]} {STATUS_LABEL[p.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
