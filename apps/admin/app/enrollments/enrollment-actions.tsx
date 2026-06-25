'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  enrollmentId: string;
}

/**
 * EnrollmentActions — кнопки Одобрить / Отклонить.
 * Client Component — нужны onClick + router.refresh().
 * Вызывает внутренний prxy-роут /api/proxy/enrollments/:id/status
 * чтобы не хранить API-токен на клиенте.
 */
export function EnrollmentActions({ enrollmentId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'approve' | 'drop' | null>(null);

  const updateStatus = async (status: 'ACTIVE' | 'DROPPED') => {
    setLoading(status === 'ACTIVE' ? 'approve' : 'drop');
    try {
      const res = await fetch(`/api/proxy/enrollments/${enrollmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex shrink-0 gap-2">
      <button
        onClick={() => void updateStatus('ACTIVE')}
        disabled={loading !== null}
        className="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
      >
        {loading === 'approve' ? '...' : 'Одобрить'}
      </button>
      <button
        onClick={() => void updateStatus('DROPPED')}
        disabled={loading !== null}
        className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
      >
        {loading === 'drop' ? '...' : 'Отклонить'}
      </button>
    </div>
  );
}
