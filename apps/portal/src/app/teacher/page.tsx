import Link from 'next/link';
import { getServerToken } from '../../lib/server-token';
import { apiFetch } from '../../lib/api';
import TeacherNav from '../../components/TeacherNav';

export const revalidate = 0;

interface ClassItem {
  id: string;
  title: string;
  level: string;
  language: { name: string };
  _count: { enrollments: number };
}

interface Lesson {
  id: string;
  title: string;
  starts_at: string;
  class: { title: string };
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

function levelBadge(level: string) {
  if (['A1', 'A2'].includes(level)) return 'glass-option-emerald';
  if (['B1', 'B2'].includes(level)) return 'glass-option-blue';
  return 'glass-option-red';
}

export default async function TeacherDashboardPage() {
  const token = await getServerToken();

  const [classRes, lessonRes] = await Promise.allSettled([
    apiFetch('/classes/my', token),
    apiFetch('/lessons/upcoming?limit=5', token),
  ]);

  const classes: ClassItem[] =
    classRes.status === 'fulfilled' && classRes.value.ok
      ? ((await classRes.value.json()) as ClassItem[])
      : [];

  const lessons: Lesson[] =
    lessonRes.status === 'fulfilled' && lessonRes.value.ok
      ? ((await lessonRes.value.json()) as Lesson[])
      : [];

  return (
    <>
      <TeacherNav />
      <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
        {/* Hero */}
        <div className="glass-emerald rounded-3xl px-5 py-5">
          <p
            className="mb-1 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--glass-accent)' }}
          >
            Панель преподавателя
          </p>
          <h1 className="mb-0.5 text-xl font-bold" style={{ color: 'var(--glass-text)' }}>
            Панель преподавателя 👋
          </h1>
          <p className="text-sm" style={{ color: 'var(--glass-hint)' }}>
            {classes.length > 0 ? `Классов: ${classes.length}` : 'Нет назначенных классов'}
          </p>
        </div>

        {/* My classes */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold" style={{ color: 'var(--glass-text)' }}>
              Мои классы
            </h2>
          </div>
          {classes.length === 0 ? (
            <div className="glass rounded-2xl px-4 py-8 text-center">
              <p className="text-2xl">📭</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
                Нет назначенных классов
              </p>
            </div>
          ) : (
            <div className="glass-section overflow-hidden rounded-2xl">
              {classes.map((c, i) => (
                <Link
                  key={c.id}
                  href={`/teacher/classes/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-all active:scale-[0.98]"
                  style={{
                    borderBottom:
                      i < classes.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                    style={{ background: 'var(--glass-green-bg)' }}
                  >
                    📚
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--glass-text)' }}
                    >
                      {c.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {c.language.name} · {c._count.enrollments} студ.
                    </p>
                  </div>
                  <span
                    className={`${levelBadge(c.level)} shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold`}
                  >
                    {c.level}
                  </span>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--glass-hint)' }}>
                    ›
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming lessons */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-sm font-bold" style={{ color: 'var(--glass-text)' }}>
              Ближайшие уроки
            </h2>
            <Link
              href="/teacher/schedule"
              className="text-xs font-semibold"
              style={{ color: 'var(--glass-accent)' }}
            >
              Расписание →
            </Link>
          </div>
          {lessons.length === 0 ? (
            <div className="glass rounded-2xl px-4 py-6 text-center">
              <p className="text-sm" style={{ color: 'var(--glass-hint)' }}>
                Нет запланированных уроков
              </p>
            </div>
          ) : (
            <div className="glass-section overflow-hidden rounded-2xl">
              {lessons.map((l, i) => (
                <div
                  key={l.id}
                  className="flex items-start gap-3 px-4 py-3.5"
                  style={{
                    borderBottom:
                      i < lessons.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                    style={{ background: 'var(--glass-green-bg)' }}
                  >
                    🕐
                  </span>
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--glass-text)' }}
                    >
                      {l.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {l.class.title} · {fmtDate(l.starts_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick HW links */}
        {classes.length > 0 && (
          <section>
            <h2 className="mb-2 px-1 text-sm font-bold" style={{ color: 'var(--glass-text)' }}>
              Быстрый доступ к ДЗ
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {classes.slice(0, 4).map((c) => (
                <Link
                  key={c.id}
                  href={`/teacher/classes/${c.id}/homework`}
                  className="glass-card flex flex-col items-center gap-1.5 rounded-2xl px-3 py-3 transition-all active:scale-95"
                >
                  <span className="text-2xl">📝</span>
                  <span
                    className="text-center text-xs font-semibold leading-tight"
                    style={{ color: 'var(--glass-hint)' }}
                  >
                    {c.title}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
