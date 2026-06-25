'use client';

/**
 * SettingsPage — управление настройками платёжных провайдеров.
 * Client Component: интерактивные переключатели.
 *
 * Данные загружаются через /api/proxy/settings/payment-providers.
 * PATCH включает/выключает провайдера и обновляет порядок отображения.
 *
 * PaymentProvider enum: PAYME | CLICK | UZUM
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProviderConfig {
  id: string;
  provider: string;
  is_enabled: boolean;
  display_order: number;
  config: Record<string, unknown>;
  updated_at: string;
}

const PROVIDER_LABEL: Record<string, string> = {
  PAYME: 'Payme',
  CLICK: 'Click',
  UZUM: 'Uzum Bank',
};

const PROVIDER_ICON: Record<string, string> = {
  PAYME: '💳',
  CLICK: '🟦',
  UZUM: '🟣',
};

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/proxy/settings/payment-providers');
        if (res.ok) {
          const data = (await res.json()) as ProviderConfig[];
          setProviders(data);
        } else {
          setError('Не удалось загрузить настройки');
        }
      } catch {
        setError('Сетевая ошибка');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async (provider: ProviderConfig) => {
    setSaving(provider.provider);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/proxy/settings/payment-providers/${provider.provider}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !provider.is_enabled }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setError(err.message ?? 'Ошибка при сохранении');
        return;
      }

      const updated = (await res.json()) as ProviderConfig;
      setProviders((prev) => prev.map((p) => (p.provider === provider.provider ? updated : p)));
      setSuccess(`${PROVIDER_LABEL[provider.provider] ?? provider.provider} обновлён`);
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Сетевая ошибка');
    } finally {
      setSaving(null);
    }
  };

  const handleOrderChange = async (provider: ProviderConfig, order: number) => {
    setSaving(provider.provider);
    setError('');

    try {
      const res = await fetch(`/api/proxy/settings/payment-providers/${provider.provider}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_order: order }),
      });

      if (!res.ok) return;

      const updated = (await res.json()) as ProviderConfig;
      setProviders((prev) =>
        prev
          .map((p) => (p.provider === provider.provider ? updated : p))
          .sort((a, b) => a.display_order - b.display_order),
      );
    } catch {
      /* no-op */
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Настройки</h1>
          <p className="mt-1 text-sm text-gray-500">Управление платёжными провайдерами.</p>
        </div>
        <Link href="/" className="text-sm text-blue-500 hover:underline">
          ← Дашборд
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          ✅ {success}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Платёжные провайдеры
      </h2>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-400 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.provider}
              className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <span className="text-2xl">{PROVIDER_ICON[provider.provider] ?? '💳'}</span>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {PROVIDER_LABEL[provider.provider] ?? provider.provider}
                </p>
                <p className="text-xs text-gray-400">
                  Порядок:
                  <input
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={provider.display_order}
                    disabled={saving === provider.provider}
                    onBlur={(e) => void handleOrderChange(provider, Number(e.target.value))}
                    className="ml-1 w-14 rounded border border-gray-200 px-1 py-0.5 text-xs outline-none"
                  />
                  · Обновлён: {new Date(provider.updated_at).toLocaleDateString('ru-RU')}
                </p>
              </div>
              {/* Toggle switch */}
              <button
                onClick={() => void handleToggle(provider)}
                disabled={saving === provider.provider}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                  provider.is_enabled ? 'bg-green-500' : 'bg-gray-300'
                }`}
                title={provider.is_enabled ? 'Отключить' : 'Включить'}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    provider.is_enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="w-16 text-right text-xs font-medium">
                {saving === provider.provider ? (
                  <span className="text-gray-400">Сохр...</span>
                ) : provider.is_enabled ? (
                  <span className="text-green-600">Вкл</span>
                ) : (
                  <span className="text-gray-400">Выкл</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Изменение настроек записывается в{' '}
        <Link href="/audit" className="text-blue-500 hover:underline">
          журнал аудита
        </Link>
        .
      </p>
    </div>
  );
}
