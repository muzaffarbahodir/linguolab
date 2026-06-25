import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

import { authOptions } from '../../lib/auth';
import { SetGroupForm } from './set-group-form';
import { SetScheduleForm } from './set-schedule-form';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

interface Class {
  id: string;
  title: string;
  level: string;
  price_uzs: number;
  max_students: number;
  enrolled_count: number;
  spots_left: number;
  telegram_chat_id?: string | null;
  schedule_days: string[];
  schedule_time: string | null;
  schedule_duration: number | null;
  language: { flag_emoji: string; name_ru: string; color: string | null };
  teacher: { user: { first_name: string; last_name: string | null } };
}

async function getClasses(token: string): Promise<Class[]> {
  const res = await fetch(`${API_URL}/api/v1/classes`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json() as Promise<Class[]>;
}

export default async function ClassesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) redirect('/login');

  const classes = await getClasses(session.accessToken);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Классы</h1>
          <p className="mt-1 text-sm text-gray-500">
            Привяжите Telegram-группу к классу — студенты получат invite при одобрении заявки.
          </p>
        </div>
        <Link href="/" className="text-sm text-blue-500 hover:underline">
          ← Дашборд
        </Link>
      </div>

      <div className="space-y-3">
        {classes.map((c) => (
          <div key={c.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.language.flag_emoji} {c.title}
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">
                    {c.level}
                  </span>
                </p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {c.teacher.user.first_name} {c.teacher.user.last_name ?? ''} · {c.enrolled_count}/
                  {c.max_students} студентов · {(c.price_uzs / 1000).toFixed(0)}K сум/мес
                </p>
                {c.telegram_chat_id ? (
                  <p className="mt-1 text-xs text-green-600">
                    ✅ Группа привязана: <code className="font-mono">{c.telegram_chat_id}</code>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-amber-500">⚠ Telegram-группа не привязана</p>
                )}
                {c.schedule_days?.length ? (
                  <p className="mt-1 text-xs text-blue-600">
                    🗓 {c.schedule_days.join(', ')} · {c.schedule_time ?? '—'} ·{' '}
                    {c.schedule_duration ?? '—'} мин
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-400">📅 Расписание не задано</p>
                )}
              </div>
              <SetGroupForm classId={c.id} currentChatId={c.telegram_chat_id ?? null} />
            </div>

            <SetScheduleForm
              classId={c.id}
              currentDays={c.schedule_days ?? []}
              currentTime={c.schedule_time ?? null}
              currentDuration={c.schedule_duration ?? null}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
