import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { authOptions } from '../../lib/auth';
import { EnrollmentActions } from './enrollment-actions';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ожидает',
  ACTIVE: 'Активна',
  DROPPED: 'Отменена',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  ACTIVE: 'bg-green-100 text-green-700',
  DROPPED: 'bg-gray-100 text-gray-500',
};

interface Enrollment {
  id: string;
  status: string;
  enrolled_at: string;
  student: {
    id: string;
    first_name: string;
    last_name: string | null;
    telegram_username: string | null;
  };
  class: {
    id: string;
    title: string;
    level: string;
    telegram_chat_id: string | null;
    language: { flag_emoji: string; name_ru: string };
    teacher: { user: { first_name: string; last_name: string | null } };
  };
}

async function getEnrollments(token: string): Promise<Enrollment[]> {
  const res = await fetch(`${API_URL}/api/v1/enrollments?status=PENDING`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<Enrollment[]>;
}

export default async function EnrollmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) redirect('/login');

  const enrollments = await getEnrollments(session.accessToken);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Заявки на запись</h1>
          <p className="mt-1 text-sm text-gray-500">
            Одобрите или отклоните заявки студентов. При одобрении студент получит invite в
            Telegram-группу (если группа привязана к классу).
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-500 hover:underline">
          ← Дашборд
        </Link>
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-16 text-center text-gray-400">
          Нет заявок со статусом «Ожидает»
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments.map((e) => (
            <div
              key={e.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {e.student.first_name} {e.student.last_name ?? ''}
                  {e.student.telegram_username && (
                    <span className="ml-2 text-sm text-gray-400">
                      @{e.student.telegram_username}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-gray-600">
                  {e.class.language.flag_emoji} {e.class.title}
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                    {e.class.level}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Преподаватель: {e.class.teacher.user.first_name}{' '}
                  {e.class.teacher.user.last_name ?? ''}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[e.status] ?? ''}`}
                  >
                    {STATUS_LABEL[e.status] ?? e.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(e.enrolled_at).toLocaleDateString('ru-RU')}
                  </span>
                  {!e.class.telegram_chat_id && (
                    <span className="text-xs text-amber-500">⚠ Группа не привязана</span>
                  )}
                </div>
              </div>
              {e.status === 'PENDING' && <EnrollmentActions enrollmentId={e.id} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
