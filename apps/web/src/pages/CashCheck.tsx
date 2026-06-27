/**
 * CashCheckPage — «чек» наличной оплаты для студента: номер заказа, сумма и
 * QR-код. Студент показывает QR менеджеру; менеджер сканирует и закрывает заказ.
 * Route: /cash-check/:id
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import { Banknote, CheckCircle2 } from 'lucide-react';

import { useBackButton } from '../hooks/useBackButton';
import { usePaymentDetail } from '../api/payments';
import { formatUzs } from '../lib/money';
import { orderNo } from '../lib/orderNumber';

const BOT_LINK = 'https://t.me/linguolab_bot/app?startapp=cash_';

export function CashCheckPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading } = usePaymentDetail(id);

  useBackButton(() => navigate(-1));

  const number = id ? orderNo('P', id) : '—';
  const paid = p?.status === 'PAID';
  const amount = p ? formatUzs(Math.round(Number(p.amount_tiyin) / 100)) : '';

  return (
    <div className="glass-fade-in flex min-h-screen flex-col items-center gap-5 px-4 pb-10 pt-8">
      <div className="bg-brand/12 flex h-14 w-14 items-center justify-center rounded-2xl">
        <Banknote className="text-brand h-7 w-7" />
      </div>
      <div className="text-center">
        <h1 className="text-xl font-bold">{t('payment.check_title')}</h1>
        <p className="text-muted mt-1 text-sm">
          {t('payment.order_no')}{' '}
          <span className="font-mono font-semibold text-[color:var(--text)]">{number}</span>
        </p>
      </div>

      {isLoading ? (
        <div className="border-brand/30 border-t-brand mt-6 h-7 w-7 animate-spin rounded-full border-4" />
      ) : paid ? (
        <div className="bg-ok/10 border-ok/25 flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border p-6 text-center">
          <CheckCircle2 className="text-ok h-10 w-10" />
          <p className="font-semibold">{t('payment.cash_paid_closed')}</p>
          {p?.class && <p className="text-muted text-sm">{p.class.title}</p>}
          <p className="text-lg font-bold">{amount}</p>
        </div>
      ) : (
        <>
          {/* Чек с QR — белый фон, чтобы QR всегда сканировался */}
          <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white p-6 shadow-lg">
            <QRCodeSVG value={`${BOT_LINK}${id}`} size={208} level="M" marginSize={1} />
            <div className="w-full border-t border-dashed border-gray-300" />
            <div className="w-full text-center text-gray-900">
              {p?.class && <p className="text-sm font-semibold">{p.class.title}</p>}
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{amount}</p>
              <p className="mt-1 font-mono text-xs text-gray-500">{number}</p>
            </div>
          </div>
          <p className="text-muted max-w-xs text-center text-sm">
            {t('payment.cash_show_to_manager')}
          </p>
        </>
      )}

      <button
        onClick={() => navigate('/courses')}
        className="press text-tg-hint mt-2 text-sm underline"
      >
        {t('payment.cash_pending_ok')}
      </button>
    </div>
  );
}
