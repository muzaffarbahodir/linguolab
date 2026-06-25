'use client';

/**
 * BroadcastPage — форма массовой рассылки Telegram-сообщений.
 * Client Component: форма с интерактивным состоянием.
 *
 * Функциональность:
 *   - Ввод текста сообщения (textarea)
 *   - Выбор цели: все студенты / конкретный класс (classId)
 *   - Предварительный просмотр количества получателей (после отправки)
 *   - Подтверждение перед отправкой (confirm dialog)
 */
import { useState } from 'react';
import Link from 'next/link';

interface BroadcastResult {
  queued: number;
}

export default function BroadcastPage() {
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Введите текст сообщения');
      return;
    }

    const targetLabel = target === 'all' ? 'всем активным студентам' : `классу ${target}`;
    const confirmed = window.confirm(
      `Отправить рассылку ${targetLabel}?\n\nСообщение:\n${message.slice(0, 200)}`,
    );
    if (!confirmed) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/proxy/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, target }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        setError(err.message ?? 'Ошибка при отправке');
        return;
      }

      const data = (await res.json()) as BroadcastResult;
      setResult(data);
      setMessage('');
      setTarget('all');
    } catch {
      setError('Сетевая ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Массовая рассылка</h1>
          <p className="mt-1 text-sm text-gray-500">
            Telegram-сообщение через BullMQ очередь. Лимит: 500 студентов.
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-500 hover:underline">
          ← Дашборд
        </Link>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        {/* Target */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Получатели</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            <option value="all">Все активные студенты</option>
            {/* Конкретный класс — ввод classId вручную */}
          </select>
          {target !== 'all' && (
            <input
              type="text"
              placeholder="ID класса"
              value={target === 'all' ? '' : target}
              onChange={(e) => setTarget(e.target.value || 'all')}
              className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          )}
          <button
            type="button"
            onClick={() => setTarget(target === 'all' ? '' : 'all')}
            className="mt-1 text-xs text-blue-500 hover:underline"
          >
            {target === 'all' ? '→ Указать конкретный класс' : '→ Всем студентам'}
          </button>
        </div>

        {/* Message */}
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Текст сообщения <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            placeholder="Введите текст сообщения. Поддерживается HTML: <b>жирный</b>, <i>курсив</i>, <a href='...'>ссылка</a>"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
          <p className="mt-1 text-right text-xs text-gray-400">{message.length} символов</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Success */}
        {result && (
          <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            ✅ Поставлено в очередь: <b>{result.queued}</b> сообщений. Telegram-уведомления будут
            отправлены в течение нескольких минут.
          </div>
        )}

        {/* Send button */}
        <button
          onClick={() => void handleSend()}
          disabled={loading || !message.trim()}
          className="w-full rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white active:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Отправка...' : '📢 Отправить рассылку'}
        </button>

        <p className="mt-3 text-center text-xs text-gray-400">
          Действие записывается в журнал аудита.{' '}
          <Link href="/audit" className="text-blue-500 hover:underline">
            Открыть журнал
          </Link>
        </p>
      </div>
    </div>
  );
}
