/**
 * AuditPage — журнал административных действий.
 * Server Component: данные загружаются на сервере.
 *
 * Отображает последние 50 событий с фильтрацией по action и entity_type.
 * Доступно: ADMIN, SUPER_ADMIN.
 */
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { authOptions } from '../../lib/auth';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

const ACTION_LABEL: Record<string, string> = {
  role_changed: '🔑 Роль изменена',
  student_deleted: '🗑 Студент удалён',
  teacher_created: '👨‍🏫 Учитель создан',
  teacher_deleted: '🗑 Учитель удалён',
  class_created: '📚 Класс создан',
  class_deleted: '🗑 Класс удалён',
  broadcast_sent: '📢 Рассылка отправлена',
  payment_refunded: '💸 Возврат оплаты',
  settings_updated: '⚙️ Настройки обновлены',
};

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  actor: {
    id: string;
    first_name: string;
    last_name: string | null;
    role: string;
  };
}

interface AuditResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  pages: number;
}

async function getAuditLog(token: string, page: number): Promise<AuditResponse> {
  const res = await fetch(`${API_URL}/api/v1/admin/audit?page=${page}&limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return { items: [], total: 0, page: 1, pages: 1 };
  return res.json() as Promise<AuditResponse>;
}

export default async function AuditPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) redirect('/login');

  const page = Number(searchParams.page ?? 1);
  const data = await getAuditLog(session.accessToken, page);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Журнал аудита</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data.total} событий · страница {data.page} из {data.pages}
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-500 hover:underline">
          ← Дашборд
        </Link>
      </div>

      {data.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          Событий пока нет
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Время</th>
                <th className="px-4 py-3 text-left">Действие</th>
                <th className="px-4 py-3 text-left">Исполнитель</th>
                <th className="px-4 py-3 text-left">Сущность</th>
                <th className="px-4 py-3 text-left">Детали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.items.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">
                    {new Date(entry.created_at).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {ACTION_LABEL[entry.action] ?? entry.action}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {entry.actor.first_name} {entry.actor.last_name ?? ''}
                    <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-400">
                      {entry.actor.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {entry.entity_type}
                    {entry.entity_id && (
                      <span className="ml-1 font-mono text-xs text-gray-300">
                        {entry.entity_id.slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-gray-400">
                    {JSON.stringify(entry.meta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data.pages > 1 && (
        <div className="mt-4 flex gap-2">
          {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/audit?page=${p}`}
              className={`rounded px-3 py-1 text-sm ${
                p === data.page
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
