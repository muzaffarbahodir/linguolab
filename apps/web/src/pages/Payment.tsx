/**
 * Payment.tsx — страница оплаты класса.
 */
import { useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Banknote, Receipt } from 'lucide-react';
import type { ReactNode } from 'react';
import { useBackButton } from '../hooks/useBackButton';

import { useCheckout, useMyPayments, useFetchReceipt, type PaymentProvider } from '../api/payments';
import { useMyEnrollments } from '../api/enrollments';
import { formatUzs } from '../lib/money';
import { useCurrency } from '../hooks/useCurrency';
import { PAYMENT_STATUS } from '../lib/status';
import { toast } from '../store/toast';
import { EmptyState } from '../components/EmptyState';

const PROVIDERS: { id: PaymentProvider; label: string; logo?: string; icon?: ReactNode }[] = [
  { id: 'PAYME', label: 'Payme', logo: '💳' },
  { id: 'CLICK', label: 'Click', logo: '🔵' },
  { id: 'CASH', label: 'payment.cash', icon: <Banknote className="text-brand h-6 w-6" /> },
];

export default function Payment() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const { classId, classTitle, priceUzs, studentId, trialId, offlineTrialLanguageId } =
    (location.state ?? {}) as {
      classId?: string;
      classTitle?: string;
      priceUzs?: number;
      studentId?: string;
      trialId?: string;
      offlineTrialLanguageId?: string;
    };

  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('PAYME');
  const [redirected, setRedirected] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [months, setMonths] = useState(1);
  const { fmt } = useCurrency();

  useBackButton(() => navigate(-1));

  const checkout = useCheckout();
  const fetchReceipt = useFetchReceipt();
  const { data: history, isLoading: historyLoading } = useMyPayments();
  const { data: enrollments } = useMyEnrollments();

  // План помесячной оплаты доступен только для оплаты курса (не пробного).
  const isCoursePayment = priceUzs !== undefined && !offlineTrialLanguageId && !trialId;
  const total = (priceUzs ?? 0) * (isCoursePayment ? months : 1);

  // Стабильный idempotency_key на пару (класс, провайдер, план) — повтор/двойной
  // клик не плодит дубли PENDING. Смена параметров → новый ключ → новый платёж.
  const idempotencyKey = useMemo(
    () => crypto.randomUUID(),
    [classId, selectedProvider, studentId, trialId, offlineTrialLanguageId, months],
  );

  const handlePay = async () => {
    if (!classId) return;
    try {
      const result = await checkout.mutateAsync({
        provider: selectedProvider,
        class_id: classId,
        idempotency_key: idempotencyKey,
        ...(studentId ? { student_id: studentId } : {}),
        ...(trialId ? { trial_id: trialId } : {}),
        ...(offlineTrialLanguageId ? { offline_trial_language_id: offlineTrialLanguageId } : {}),
        ...(isCoursePayment ? { period_months: months } : {}),
      });
      // Наличные — нет редиректа в кассу: показываем чек с QR для менеджера.
      if (selectedProvider === 'CASH' || !result.redirect_url) {
        navigate(`/cash-check/${result.payment_id}`);
        return;
      }
      WebApp.openLink(result.redirect_url);
      setRedirected(true);
    } catch {
      toast.error(t('payment.load_error'));
    }
  };

  const handleReceipt = async (paymentId: string) => {
    setReceiptId(paymentId);
    try {
      const r = await fetchReceipt.mutateAsync(paymentId);
      if (r.receipt_url) {
        WebApp.openLink(r.receipt_url);
      } else {
        toast.info(t('payment.receipt_pending'));
      }
    } catch {
      toast.error(t('payment.load_error'));
    } finally {
      setReceiptId(null);
    }
  };

  // ── Checkout screen ──────────────────────────────────────────────────────────

  if (classId && !redirected) {
    return (
      <div className="glass-fade-in flex flex-col gap-6 p-4">
        <h1 className="text-xl font-bold">{t('payment.title')}</h1>

        {/* Class info */}
        <div className="glass-card rounded-2xl p-4">
          <div className="text-tg-hint mb-1 text-sm">{t('payment.class')}</div>
          <div className="font-semibold">{classTitle}</div>
          {priceUzs !== undefined && (
            <div className="text-brand mt-1 text-lg font-bold">
              {fmt(priceUzs)}
              {isCoursePayment && (
                <span className="text-faint text-xs font-normal">{t('payment.per_month')}</span>
              )}
            </div>
          )}
        </div>

        {/* План оплаты (помесячно) */}
        {isCoursePayment && (
          <div>
            <div className="text-tg-hint mb-2 text-sm">{t('payment.plan_title')}</div>
            <div className="flex gap-2">
              {[1, 3, 6].map((m) => (
                <button
                  key={m}
                  onClick={() => setMonths(m)}
                  className={`press flex-1 rounded-2xl border-2 py-2.5 text-center transition-colors ${
                    months === m ? 'bg-brand/15 border-brand' : 'bg-surface border-hairline'
                  }`}
                >
                  <div className="text-sm font-bold">{t('payment.months_n', { n: m })}</div>
                  <div className="text-faint text-[11px]">{fmt(priceUzs! * m)}</div>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between px-1">
              <span className="text-muted text-sm">{t('payment.total')}</span>
              <span className="text-brand text-lg font-bold">{fmt(total)}</span>
            </div>
          </div>
        )}

        {/* Provider select */}
        <div>
          <div className="text-tg-hint mb-2 text-sm">{t('payment.select_provider')}</div>
          <div className="flex flex-col gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`press flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition-colors ${
                  selectedProvider === p.id
                    ? 'bg-brand/15 border-brand'
                    : 'bg-surface border-hairline'
                }`}
              >
                {p.icon ?? <span className="text-2xl">{p.logo}</span>}
                <span className="font-medium">{p.label.includes('.') ? t(p.label) : p.label}</span>
                {selectedProvider === p.id && (
                  <span className="text-brand ml-auto font-bold">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <p className="text-tg-hint text-center text-xs">
          {selectedProvider === 'CASH' ? t('payment.cash_hint') : t('payment.redirect_hint')}
        </p>

        <button
          onClick={handlePay}
          disabled={checkout.isPending}
          className="glass-btn press w-full rounded-2xl py-3 font-semibold disabled:opacity-60"
        >
          {checkout.isPending ? t('payment.paying') : t('payment.pay_btn')}
        </button>

        <button onClick={() => navigate(-1)} className="text-tg-hint text-center text-sm underline">
          {t('payment.back_to_class')}
        </button>
      </div>
    );
  }

  // ── History screen ───────────────────────────────────────────────────────────

  return (
    <div className="glass-fade-in flex flex-col gap-4 p-4">
      {redirected && (
        <div className="bg-ok/15 border-ok/30 text-ok rounded-2xl border p-4 text-sm">
          {t('payment.redirect_hint')}
        </div>
      )}

      <h1 className="text-xl font-bold">{t('payment.history_title')}</h1>

      {/* ── Счёт к оплате — неоплаченные (PENDING) записи ── */}
      {enrollments && enrollments.filter((e) => e.status === 'PENDING').length > 0 && (
        <div>
          <p className="text-muted mb-2 text-xs font-semibold uppercase tracking-wide">
            {t('payment.invoice_title')}
          </p>
          <div className="stagger flex flex-col gap-2">
            {enrollments
              .filter((e) => e.status === 'PENDING')
              .map((e) => {
                const color = e.class.language.color ?? '#6366f1';
                return (
                  <div
                    key={e.id}
                    className="bg-surface rounded-2xl border p-4"
                    style={{ borderColor: `${color}33` }}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                        style={{ background: `${color}22` }}
                      >
                        {e.class.language.flag_emoji}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold leading-tight">{e.class.title}</p>
                        <p className="text-muted text-xs">
                          {e.class.language.name_ru} · {e.class.level}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold" style={{ color }}>
                          {fmt(e.class.price_uzs)}
                        </p>
                        <p className="text-faint text-xs">{t('payment.per_month')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        navigate('/payment', {
                          state: {
                            classId: e.class.id,
                            classTitle: e.class.title,
                            priceUzs: e.class.price_uzs,
                          },
                        })
                      }
                      className="press w-full rounded-xl py-2.5 text-sm font-semibold text-white"
                      style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
                    >
                      {t('payment.pay_invoice')}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {historyLoading ? (
        <div className="flex justify-center py-8">
          <div className="border-brand/30 border-t-brand h-6 w-6 animate-spin rounded-full border-4" />
        </div>
      ) : !history?.length ? (
        <EmptyState emoji="🧾" title={t('payment.history_empty')} />
      ) : (
        <div className="stagger flex flex-col gap-3">
          {history.map((p) => (
            <div key={p.id} className="glass-card rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{p.class?.title ?? '—'}</div>
                  <div className="text-tg-hint text-xs">
                    {new Date(p.created_at).toLocaleDateString()}
                  </div>
                </div>
                {(() => {
                  const m = PAYMENT_STATUS[p.status] ?? PAYMENT_STATUS.PENDING!;
                  return (
                    <span className="text-sm font-semibold" style={{ color: m.color }}>
                      {m.icon} {t(m.labelKey)}
                    </span>
                  );
                })()}
              </div>
              <div className="text-tg-hint mt-1 text-sm">
                {formatUzs(Math.round(Number(p.amount_tiyin) / 100))}
                {' · '}
                {p.provider}
              </div>
              {p.status === 'PAID' && (
                <button
                  onClick={() => handleReceipt(p.id)}
                  disabled={receiptId === p.id}
                  className="bg-surface border-hairline press mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-sm font-medium disabled:opacity-50"
                >
                  <Receipt className="h-4 w-4" />
                  {t('payment.receipt_btn')}
                </button>
              )}
              {p.provider === 'CASH' && p.status === 'PENDING' && (
                <button
                  onClick={() => navigate(`/cash-check/${p.id}`)}
                  className="bg-brand/15 text-brand-400 press mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold"
                >
                  <Banknote className="h-4 w-4" />
                  {t('payment.show_check')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
