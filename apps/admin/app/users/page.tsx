import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { authOptions } from '../../lib/auth';
import { UserRoleChange } from './user-role-change';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

interface User {
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

interface UsersResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
}

const ROLE_COLOR: Record<string, string> = {
  STUDENT: 'bg-blue-50 text-blue-700',
  PARENT: 'bg-purple-50 text-purple-700',
  TEACHER: 'bg-emerald-50 text-emerald-700',
  MANAGER: 'bg-amber-50 text-amber-700',
  ADMIN: 'bg-red-50 text-red-700',
  SUPER_ADMIN: 'bg-red-100 text-red-900',
};

async function getUsers(token: string, page = 1): Promise<UsersResponse> {
  const res = await fetch(`${API_URL}/api/v1/users?page=${page}&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return { data: [], total: 0, page: 1, limit: 50 };
  return res.json() as Promise<UsersResponse>;
}

async function getPendingCount(token: string): Promise<number> {
  const res = await fetch(`${API_URL}/api/v1/users/pending`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return 0;
  const data = (await res.json()) as unknown[];
  return data.length;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) redirect('/login');

  const { page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));

  const [{ data: users, total }, pendingCount] = await Promise.all([
    getUsers(session.accessToken, page),
    getPendingCount(session.accessToken),
  ]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="mt-1 text-sm text-gray-500">Всего: {total} пользователей</p>
        </div>
        <div className="flex gap-3">
          {pendingCount > 0 && (
            <Link
              href="/users/pending"
              className="flex items-center gap-1.5 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100"
            >
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {pendingCount} ожидают →
            </Link>
          )}
          <Link href="/" className="text-sm text-gray-400 hover:underline">
            ← Дашборд
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="divide-y divide-gray-100">
          {users.map((user) => {
            const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
            const createdAt = new Date(user.created_at).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: 'short',
              year: '2-digit',
            });

            return (
              <div key={user.id} className="flex items-center gap-4 px-6 py-3.5">
                {/* Avatar */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {user.first_name[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{fullName}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ROLE_COLOR[user.role] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {user.role}
                    </span>
                    {!user.is_active && (
                      <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {user.telegram_username ? `@${user.telegram_username}` : user.telegram_user_id}
                    {' · '}
                    {createdAt}
                  </p>
                </div>

                {/* Role change */}
                <UserRoleChange userId={user.id} currentRole={user.role} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {page > 1 && (
            <Link
              href={`/users?page=${page - 1}`}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ← Назад
            </Link>
          )}
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/users?page=${page + 1}`}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Вперёд →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
