import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerToken } from '../../../../lib/server-token';
import { apiFetch } from '../../../../lib/api';
import TeacherNav from '../../../../components/TeacherNav';

interface Student {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  enrollment: { status: string; enrolled_at: string };
}

interface ClassDetail {
  id: string;
  title: string;
  level: string;
  language: { name: string };
  _count: { enrollments: number };
}

function levelBadge(level: string) {
  if (['A1', 'A2'].includes(level)) return 'glass-option-emerald';
  if (['B1', 'B2'].includes(level)) return 'glass-option-blue';
  return 'glass-option-red';
}

export default async function TeacherClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getServerToken();

  const [clsRes, studRes] = await Promise.allSettled([
    apiFetch(`/classes/${id}`, token),
    apiFetch(`/classes/${id}/students`, token),
  ]);

  const cls: ClassDetail | null =
    clsRes.status === 'fulfilled' && clsRes.value.ok
      ? ((await clsRes.value.json()) as ClassDetail)
      : null;

  const students: Student[] =
    studRes.status === 'fulfilled' && studRes.value.ok
      ? ((await studRes.value.json()) as Student[])
      : [];

  if (!cls) redirect('/teacher');

  return (
    <>
      <TeacherNav />
      <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
        {/* Back */}
        <Link
          href="/teacher"
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: 'var(--glass-accent)' }}
        >
          ← Мои классы
        </Link>

        {/* Class header */}
        <div className="glass-emerald rounded-3xl px-5 py-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p
                className="mb-1 text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--glass-accent)' }}
              >
                Класс
              </p>
              <h1 className="text-lg font-bold" style={{ color: 'var(--glass-text)' }}>
                {cls.title}
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--glass-hint)' }}>
                {cls.language.name} · {cls._count.enrollments} студентов
              </p>
            </div>
            <span
              className={`${levelBadge(cls.level)} shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold`}
            >
              {cls.level}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/teacher/classes/${id}/lessons`}
            className="glass-btn flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold"
          >
            📅 Уроки
          </Link>
          <Link
            href={`/teacher/classes/${id}/homework`}
            className="glass-card flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold"
            style={{ color: 'var(--glass-text)' }}
          >
            📝 ДЗ
          </Link>
        </div>

        {/* Students */}
        <section>
          <p
            className="mb-2 px-1 text-xs font-bold uppercase tracking-widest"
            style={{ color: 'var(--glass-hint)' }}
          >
            Студенты ({students.length})
          </p>
          {students.length === 0 ? (
            <div className="glass rounded-2xl px-4 py-8 text-center">
              <p className="text-2xl">👥</p>
              <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
                Нет записавшихся студентов
              </p>
            </div>
          ) : (
            <div className="glass-section overflow-hidden rounded-2xl">
              {students.map((s, i) => (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom:
                      i < students.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                    style={{ background: 'var(--glass-green-bg)', color: 'var(--glass-accent)' }}
                  >
                    {s.first_name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--glass-text)' }}>
                      {s.first_name} {s.last_name ?? ''}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {s.email ?? '—'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      s.enrollment.status === 'ACTIVE' ? 'glass-option-emerald' : 'glass-option'
                    }`}
                  >
                    {s.enrollment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
