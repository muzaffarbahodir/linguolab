import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { authOptions } from '../../../lib/auth';
import { UserActivate } from './user-activate';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

interface PendingUser {
  id: string;
  telegram_user_id: string;
  telegram_username: string | null;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

async function getPendingUsers(token: string): Promise<PendingUser[]> {
  const res = await fetch(`${API_URL}/api/v1/users/pending`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<PendingUser[]>;
}

export default async function PendingUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) redirect('/login');

  const users = await getPendingUsers(session.accessToken);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ожидают активации</h1>
          <p className="mt-1 text-sm text-gray-500">
            Новые пользователи, зарегистрировавшиеся через Telegram. Выберите роль и активируйте.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/users" className="text-sm text-blue-500 hover:underline">
            Все пользователи →
          </Link>
          <Link href="/" className="text-sm text-gray-400 hover:underline">
            ← Дашборд
          </Link>
        </div>
      </div>

      {/* Count badge */}
      {users.length > 0 && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-sm font-medium text-amber-700">
            {users.length} заявок ожидают подтверждения
          </span>
        </div>
      )}

      {/* List */}
      {users.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-8 py-16 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-3 font-semibold text-gray-700">Нет новых заявок</p>
          <p className="mt-1 text-sm text-gray-500">Все пользователи активированы</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
          {users.map((user) => {
            const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
            const createdAt = new Date(user.created_at).toLocaleString('ru-RU', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={user.id} className="flex items-center gap-4 px-6 py-4">
                {/* Avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                  {user.first_name[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{fullName}</p>
                  <p className="truncate text-sm text-gray-500">
                    {user.telegram_username
                      ? `@${user.telegram_username}`
                      : `tg_id: ${user.telegram_user_id}`}
                    {' · '}
                    <span className="text-xs text-gray-400">{createdAt}</span>
                  </p>
                </div>

                {/* Actions */}
                <UserActivate userId={user.id} currentRole={user.role} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
