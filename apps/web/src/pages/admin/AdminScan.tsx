/**
 * AdminScanPage — раздел «Сканировать» для менеджера/админа.
 * Пока один тип: приём наличной оплаты по QR из чека студента.
 * В будущем сюда добавятся другие типы сканов.
 * Камера — нативный QR-сканер Telegram (showScanQrPopup). Если не сработал —
 * ручной ввод номера заказа. Route: /admin/scan
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Banknote, ScanLine, Keyboard, ChevronRight } from 'lucide-react';

import { useBackButton } from '../../hooks/useBackButton';
import { useResolveOrder } from '../../api/payments';
import { toast } from '../../store/toast';

// showScanQrPopup есть в рантайме Telegram, но отсутствует в типах SDK.
type QrScannerApi = {
  showScanQrPopup?: (params: { text?: string }, cb: (text: string) => boolean) => void;
  closeScanQrPopup?: () => void;
  isVersionAtLeast?: (v: string) => boolean;
};

/** Достаёт id платежа из QR: URL ...startapp=cash_<id> или просто cash_<id>. */
function parseCashId(text: string): string | null {
  return text.match(/cash_([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

export function AdminScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resolve = useResolveOrder();
  const [manual, setManual] = useState(false);
  const [number, setNumber] = useState('');

  useBackButton(() => navigate('/admin'));

  const wa = WebApp as unknown as QrScannerApi;
  const canScan = typeof wa.showScanQrPopup === 'function';

  const startScan = () => {
    if (!canScan) {
      setManual(true);
      return;
    }
    try {
      WebApp.HapticFeedback.impactOccurred('light');
    } catch {
      /* старый клиент */
    }
    wa.showScanQrPopup!({ text: t('scan.cash_hint') }, (text) => {
      const id = parseCashId(text);
      if (!id) return false; // не наш QR — продолжаем сканировать
      wa.closeScanQrPopup?.();
      navigate(`/cash-confirm/${id}`);
      return true;
    });
  };

  const submitManual = () => {
    const digits = number.replace(/\D/g, '');
    if (digits.length < 1) return;
    resolve.mutate(digits, {
      onSuccess: (r) => navigate(`/cash-confirm/${r.id}`),
      onError: () => toast.error(t('scan.not_found')),
    });
  };

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-10 pt-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold">{t('scan.title')}</h1>
        <p className="text-muted mt-0.5 text-sm">{t('scan.subtitle')}</p>
      </div>

      {/* Типы сканов (пока один) */}
      <div className="glass-card overflow-hidden rounded-2xl">
        <button
          onClick={startScan}
          className="press flex w-full items-center gap-3 px-4 py-4 text-left"
        >
          <div className="bg-brand/12 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <Banknote className="text-brand h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t('scan.cash_title')}</p>
            <p className="text-muted text-xs">{t('scan.cash_desc')}</p>
          </div>
          <ScanLine className="text-brand-400 h-5 w-5 shrink-0" />
        </button>
      </div>

      {/* Большая кнопка сканирования */}
      <button
        onClick={startScan}
        className="glass-btn press mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-semibold"
      >
        <ScanLine className="h-5 w-5" />
        {t('scan.scan_btn')}
      </button>

      {/* Ручной ввод */}
      {!manual ? (
        <button
          onClick={() => setManual(true)}
          className="press text-muted mt-4 flex w-full items-center justify-center gap-2 text-sm"
        >
          <Keyboard className="h-4 w-4" />
          {t('scan.manual_link')}
        </button>
      ) : (
        <div className="glass-card mt-4 rounded-2xl p-4">
          <p className="text-muted mb-2 text-xs font-semibold">{t('scan.manual_label')}</p>
          <div className="flex gap-2">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="000123"
              inputMode="numeric"
              className="bg-surface-2 border-hairline w-full rounded-xl border px-3 py-2.5 text-sm text-[color:var(--text)] outline-none"
            />
            <button
              onClick={submitManual}
              disabled={resolve.isPending || number.replace(/\D/g, '').length < 1}
              className="bg-brand press shrink-0 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-40"
            >
              {resolve.isPending ? '…' : <ChevronRight className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-faint mt-2 text-xs">{t('scan.manual_hint')}</p>
        </div>
      )}
    </div>
  );
}
