'use client';

/**
 * ExportPage — страница экспорта данных в CSV.
 *
 * Кнопки для скачивания:
 *   - Студенты → GET /api/proxy/students/export → students.csv
 *   - Платежи  → GET /api/proxy/payments/export → payments.csv
 *
 * Браузер автоматически скачивает файл через window.location.href
 * (Content-Disposition: attachment уже выставлен в proxy route).
 */
import Link from 'next/link';
import { useState } from 'react';

interface ExportButtonProps {
  href: string;
  label: string;
  description: string;
  icon: string;
}

function ExportButton({ href, label, description, icon }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    // Скачиваем через прямой переход — браузер получит Content-Disposition: attachment
    window.location.href = href;
    // Сбрасываем состояние через секунду (файл уже скачивается)
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex w-full items-center gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
    >
      <span className="text-4xl">{icon}</span>
      <div className="flex-1 text-left">
        <p className="font-semibold text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <span className="text-sm font-medium text-blue-500">
        {loading ? 'Скачивание...' : '↓ CSV'}
      </span>
    </button>
  );
}

export default function ExportPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Экспорт данных</h1>
          <p className="mt-1 text-sm text-gray-500">
            CSV-файлы с BOM для корректного открытия в Microsoft Excel.
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-500 hover:underline">
          ← Дашборд
        </Link>
      </div>

      <div className="space-y-3">
        <ExportButton
          href="/api/proxy/students/export"
          label="Студенты"
          description="id, имя, email, телефон, Telegram, язык, записи, активность"
          icon="👥"
        />
        <ExportButton
          href="/api/proxy/payments/export"
          label="Платежи"
          description="id, студент, класс, сумма (сум), провайдер, статус, дата оплаты"
          icon="💳"
        />
      </div>

      <div className="mt-6 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">
        💡 Файлы содержат BOM (byte order mark) — Excel автоматически определит кодировку UTF-8 и
        корректно отобразит кириллицу без ручной настройки.
      </div>
    </div>
  );
}
