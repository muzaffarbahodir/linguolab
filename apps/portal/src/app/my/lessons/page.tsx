import { getServerToken } from '../../../lib/server-token';
import { apiFetch } from '../../../lib/api';
import Nav from '../../../components/Nav';

export const revalidate = 0;

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  recording_url: string | null;
  class: { title: string; language: { name: string } };
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

function isUpcoming(iso: string) {
  return new Date(iso) > new Date();
}

export default async function LessonsPage() {
  const token = await getServerToken();
  const res = await apiFetch('/lessons/my?limit=30', token);
  const lessons: Lesson[] = res.ok ? ((await res.json()) as Lesson[]) : [];

  const upcoming = lessons.filter((l) => isUpcoming(l.starts_at));
  const past = lessons.filter((l) => !isUpcoming(l.starts_at));

  return (
    <>
      <Nav />
      <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
        {/* Header */}
        <div className="glass-card rounded-3xl px-5 py-5">
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
            {upcoming.length > 0
              ? `${upcoming.length} предстоящих уроков`
              : 'Нет предстоящих уроков'}
          </p>
        </div>

        {lessons.length === 0 && (
          <div className="glass rounded-2xl px-4 py-10 text-center">
            <p className="mb-1 text-2xl">📭</p>
            <p className="text-sm" style={{ color: 'var(--glass-hint)' }}>
              У вас пока нет уроков
            </p>
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <p
              className="mb-2 px-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--glass-hint)' }}
            >
              Предстоящие
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
                    <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {l.class.title} · {l.class.language.name}
                    </p>
                    <p
                      className="mt-0.5 text-xs font-medium"
                      style={{ color: 'var(--glass-accent)' }}
                    >
                      {fmtDate(l.starts_at)}
                    </p>
                  </div>
                  <span className="glass-option-emerald shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    Скоро
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Past */}
        {past.length > 0 && (
          <section>
            <p
              className="mb-2 px-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--glass-hint)' }}
            >
              Прошедшие
            </p>
            <div className="glass-section overflow-hidden rounded-2xl" style={{ opacity: 0.8 }}>
              {past.map((l, i) => (
                <div
                  key={l.id}
                  className="flex items-start gap-3 px-4 py-3.5"
                  style={{
                    borderBottom: i < past.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
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
                      {l.class.title} · {fmtDate(l.starts_at)}
                    </p>
                    {l.recording_url && (
                      <a
                        href={l.recording_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-medium"
                        style={{ color: 'var(--glass-accent)' }}
                      >
                        🎥 Запись урока →
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
