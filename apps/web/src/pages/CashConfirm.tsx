/**
 * CashConfirmPage — менеджер открывает по скану QR из наличного чека студента.
 * Показывает заказ и кнопку «Подтвердить приём наличных» → закрывает заказ
 * (PAID + запись на курс). Route: /cash-confirm/:id
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Banknote, ShieldAlert } from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { useAdminPaymentDetail } from '../api/payments';
import { useConfirmCashPayment } from '../api/admin';
import { formatUzs } from '../lib/money';
import { orderNo } from '../lib/orderNumber';
import { toast } from '../store/toast';

export function CashConfirmPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading, isError } = useAdminPaymentDetail(id);
  const confirm = useConfirmCashPayment();
  const [done, setDone] = useState(false);

  useBackButton(() => navigate(-1));

  const number = id ? orderNo('P', id) : '—';
  const amount = p ? formatUzs(Math.round(Number(p.amount_tiyin) / 100)) : '';
  const paid = done || p?.status === 'PAID';
  const studentName = p
    ? `${p.user.first_name}${p.user.last_name ? ' ' + p.user.last_name : ''}`
    : '';

  const handleConfirm = () => {
    if (!id) return;
    confirm.mutate(id, {
      onSuccess: () => setDone(true),
      onError: (e: unknown) => {
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? null;
        toast.error(msg ?? t('payment.manager_only'));
      },
    });
  };

  return (
    <div className="glass-fade-in flex min-h-screen flex-col items-center gap-5 px-4 pb-10 pt-8">
      <div className="bg-brand/12 flex h-14 w-14 items-center justify-center rounded-2xl">
        <Banknote className="text-brand h-7 w-7" />
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold">{t('payment.confirm_title')}</h1>
        <p className="text-muted mt-1 font-mono text-sm">{number}</p>
      </div>

      {isLoading ? (
        <div className="border-brand/30 border-t-brand mt-6 h-7 w-7 animate-spin rounded-full border-4" />
      ) : isError || !p ? (
        <div className="bg-danger/10 border-danger/25 mt-4 flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border p-6 text-center">
          <ShieldAlert className="text-danger h-9 w-9" />
          <p className="font-semibold">{t('payment.manager_only')}</p>
        </div>
      ) : (
        <div className="glass-card w-full max-w-sm rounded-2xl p-5">
          <Row label={t('payment.student')} value={studentName} />
          {p.class && <Row label={t('payment.course')} value={p.class.title} />}
          <Row label={t('payment.amount')} value={amount} strong />

          {paid ? (
            <div className="bg-ok/10 border-ok/25 mt-4 flex flex-col items-center gap-2 rounded-xl border p-4 text-center">
              <CheckCircle2 className="text-ok h-8 w-8" />
              <p className="font-semibold">{t('payment.confirm_done')}</p>
            </div>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={confirm.isPending}
              className="glass-btn press mt-5 w-full rounded-xl py-3 font-semibold disabled:opacity-60"
            >
              {confirm.isPending ? t('payment.paying') : t('payment.confirm_cash_btn')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="border-hairline flex items-center justify-between gap-3 border-b py-2.5 last:border-0">
      <span className="text-muted text-sm">{label}</span>
      <span className={`text-right text-sm ${strong ? 'text-lg font-bold' : 'font-medium'}`}>
        {value}
      </span>
    </div>
  );
}
