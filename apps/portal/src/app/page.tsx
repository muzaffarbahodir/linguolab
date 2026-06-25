import Link from 'next/link';
import { getServerToken } from '../lib/server-token';
import { apiFetch } from '../lib/api';
import Nav from '../components/Nav';
import { HorizontalPetals, DecorSectionTitle, GlassDivider } from '../components/FloralDecor';

export const revalidate = 0;

interface Enrollment {
  id: string;
  status: string;
  class: { id: string; title: string; language: { name: string; flag_emoji?: string } };
}

interface Lesson {
  id: string;
  title: string;
  scheduled_at: string;
  class: { title: string };
}

async function getDashboardData(token: string) {
  const [enrollRes, lessonRes] = await Promise.allSettled([
    apiFetch('/enrollments/my', token),
    apiFetch('/lessons/upcoming?limit=3', token),
  ]);

  const enrollments: Enrollment[] =
    enrollRes.status === 'fulfilled' && enrollRes.value.ok
      ? ((await enrollRes.value.json()) as Enrollment[])
      : [];

  const lessons: Lesson[] =
    lessonRes.status === 'fulfilled' && lessonRes.value.ok
      ? ((await lessonRes.value.json()) as Lesson[])
      : [];

  return { enrollments, lessons };
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

const QUICK_LINKS = [
  { href: '/my/homework', icon: '📝', label: 'Задания' },
  { href: '/my/payments', icon: '💳', label: 'Оплата' },
  { href: '/placement-test/en', icon: '🧪', label: 'Тест уровня' },
  { href: '/courses', icon: '📚', label: 'Каталог' },
];

export default async function DashboardPage() {
  const token = await getServerToken();
  const { enrollments, lessons } = await getDashboardData(token);
  const active = enrollments.filter((e) => e.status === 'ACTIVE');

  return (
    <>
      <Nav />
      <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
        {/* Hero greeting */}
        <div className="glass-card relative overflow-hidden rounded-3xl px-5 py-5">
          <HorizontalPetals className="top-4" />
          <p
            className="mb-1 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--glass-accent)' }}
          >
            Личный кабинет
          </p>
          <h1 className="shimmer-emerald-text mb-0.5 text-xl font-bold">LinguoLab ✦</h1>
          <p className="text-sm" style={{ color: 'var(--glass-hint)' }}>
            {active.length > 0 ? `Активных курсов: ${active.length}` : 'Запишитесь на первый курс'}
          </p>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-4 gap-2">
          {QUICK_LINKS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="glass-card flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 transition-all active:scale-95"
            >
              <span className="text-2xl">{c.icon}</span>
              <span
                className="text-center text-[10px] font-semibold leading-tight"
                style={{ color: 'var(--glass-hint)' }}
              >
                {c.label}
              </span>
            </Link>
          ))}
        </div>

        <GlassDivider />

        {/* My courses */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <DecorSectionTitle>Мои курсы</DecorSectionTitle>
            <Link
              href="/courses"
              className="text-xs font-semibold"
              style={{ color: 'var(--glass-accent)' }}
            >
              Все →
            </Link>
          </div>

          {active.length === 0 ? (
            <div className="glass rounded-2xl px-4 py-8 text-center">
              <p className="mb-2 text-2xl">📚</p>
              <p className="text-sm" style={{ color: 'var(--glass-hint)' }}>
                Нет активных записей
              </p>
              <Link
                href="/courses"
                className="glass-btn mt-3 inline-block rounded-xl px-4 py-2 text-xs font-bold"
              >
                Найти курс
              </Link>
            </div>
          ) : (
            <div className="glass-section overflow-hidden rounded-2xl">
              {active.slice(0, 4).map((e, i) => (
                <div
                  key={e.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom:
                      i < active.slice(0, 4).length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
                    style={{ background: 'var(--glass-green-bg)' }}
                  >
                    {e.class.language.flag_emoji ?? '🗣'}
                  </span>
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--glass-text)' }}
                    >
                      {e.class.title}
                    </p>
                    <p className="truncate text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {e.class.language.name}
                    </p>
                  </div>
                  <span className="glass-option-emerald ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    ACTIVE
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming lessons */}
        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <DecorSectionTitle>Ближайшие уроки</DecorSectionTitle>
            <Link
              href="/my/lessons"
              className="text-xs font-semibold"
              style={{ color: 'var(--glass-accent)' }}
            >
              Все →
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
                  className="flex items-start gap-3 px-4 py-3"
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
                      {l.title || l.class.title}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {l.class.title} · {fmtDate(l.scheduled_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
