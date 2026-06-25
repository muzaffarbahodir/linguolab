'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLES = ['STUDENT', 'PARENT', 'TEACHER', 'MANAGER'];

interface Props {
  userId: string;
  currentRole: string;
}

export function UserActivate({ userId, currentRole }: Props) {
  const router = useRouter();
  const [role, setRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/proxy/users/${userId}/activate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { message?: string };
        throw new Error(d.message ?? 'Ошибка активации');
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={loading}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          onClick={() => void activate()}
          disabled={loading}
          className="rounded-lg bg-green-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? '...' : '✓ Активировать'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
