import Link from 'next/link';
import { getServerToken } from '../../../lib/server-token';
import { apiFetch } from '../../../lib/api';
import TeacherNav from '../../../components/TeacherNav';

export const revalidate = 0;

interface Lesson {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  is_completed: boolean;
  class: { id: string; title: string };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export default async function TeacherSchedulePage() {
  const token = await getServerToken();

  const [upcomingRes, historyRes] = await Promise.allSettled([
    apiFetch('/lessons/upcoming?limit=20', token),
    apiFetch('/lessons/history?limit=10', token),
  ]);

  const upcoming: Lesson[] =
    upcomingRes.status === 'fulfilled' && upcomingRes.value.ok
      ? ((await upcomingRes.value.json()) as Lesson[])
      : [];

  const history: Lesson[] =
    historyRes.status === 'fulfilled' && historyRes.value.ok
      ? ((await historyRes.value.json()) as Lesson[])
      : [];

  return (
    <>
      <TeacherNav />
      <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
        {/* Header */}
        <div className="glass-emerald rounded-3xl px-5 py-5">
          <p
            className="mb-1 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--glass-accent)' }}
          >
            Расписание
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--glass-text)' }}>
            📅 Уроки
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--glass-hint)' }}>
            {upcoming.length > 0 ? `${upcoming.length} предстоящих` : 'Нет предстоящих уроков'}
          </p>
        </div>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <p
              className="mb-2 px-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--glass-hint)' }}
            >
              Предстоящие уроки
            </p>
            <div className="glass-section overflow-hidden rounded-2xl">
              {upcoming.map((l, i) => (
                <div
                  key={l.id}
                  className="flex items-start gap-3 px-4 py-3.5"
                  style={{
                    borderBottom:
                      i < upcoming.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                    style={{ background: 'var(--glass-green-bg)' }}
                  >
                    🕐
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--glass-text)' }}
                    >
                      {l.title}
                    </p>
                    <p className="text-xs font-medium" style={{ color: 'var(--glass-accent)' }}>
                      {fmtDate(l.starts_at)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {fmtTime(l.starts_at)} – {fmtTime(l.ends_at)} · {l.class.title}
                    </p>
                  </div>
                  <Link
                    href={`/teacher/classes/${l.class.id}/lessons`}
                    className="glass-option-emerald shrink-0 rounded-xl px-2.5 py-1.5 text-[10px] font-bold"
                  >
                    Управление
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* History */}
        {history.length > 0 && (
          <section>
            <p
              className="mb-2 px-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--glass-hint)' }}
            >
              Проведённые уроки
            </p>
            <div className="glass-section overflow-hidden rounded-2xl" style={{ opacity: 0.8 }}>
              {history.map((l, i) => (
                <div
                  key={l.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom:
                      i < history.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm"
                    style={{ background: 'var(--glass-green-bg)' }}
                  >
                    ✓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--glass-text)' }}
                    >
                      {l.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {fmtDate(l.starts_at)} · {l.class.title}
                    </p>
                  </div>
                  <span className="glass-option shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    Проведён
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {upcoming.length === 0 && history.length === 0 && (
          <div className="glass rounded-2xl px-4 py-10 text-center">
            <p className="text-2xl">📭</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Нет уроков
            </p>
          </div>
        )}
      </main>
    </>
  );
}
