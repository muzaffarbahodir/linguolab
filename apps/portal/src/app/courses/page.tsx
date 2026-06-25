import Link from 'next/link';
import { getServerToken } from '../../lib/server-token';
import { apiFetch } from '../../lib/api';
import Nav from '../../components/Nav';

export const revalidate = 60;

interface ClassItem {
  id: string;
  title: string;
  description: string | null;
  level: string;
  max_students: number;
  language: { name: string; code: string };
  teacher: { first_name: string; last_name: string | null } | null;
  _count: { enrollments: number };
}

const FLAG: Record<string, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
  ru: '🇷🇺',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
};

function levelBadge(level: string) {
  if (['A1', 'A2'].includes(level)) return 'glass-option-emerald';
  if (['B1', 'B2'].includes(level)) return 'glass-option-blue';
  return 'glass-option-red';
}

export default async function CoursesPage() {
  const token = await getServerToken();
  const res = await apiFetch('/classes?limit=50', token);
  const classes: ClassItem[] = res.ok ? ((await res.json()) as ClassItem[]) : [];

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
            Каталог
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--glass-text)' }}>
            📚 Курсы
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--glass-hint)' }}>
            {classes.length > 0 ? `${classes.length} курсов доступно` : 'Загрузка...'}
          </p>
        </div>

        {/* Course list */}
        {classes.length === 0 ? (
          <div className="glass rounded-2xl px-4 py-10 text-center">
            <p className="mb-1 text-2xl">📭</p>
            <p className="text-sm" style={{ color: 'var(--glass-hint)' }}>
              Курсы не найдены
            </p>
          </div>
        ) : (
          <div className="glass-section overflow-hidden rounded-2xl">
            {classes.map((c, i) => {
              const spots = c.max_students - c._count.enrollments;
              const flag = FLAG[c.language.code] ?? '🌐';
              return (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-all active:scale-[0.98]"
                  style={{
                    borderBottom:
                      i < classes.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  {/* Flag icon */}
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl"
                    style={{ background: 'var(--glass-green-bg)' }}
                  >
                    {flag}
                  </span>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className="truncate text-sm font-semibold"
                        style={{ color: 'var(--glass-text)' }}
                      >
                        {c.title}
                      </p>
                      <span
                        className={`${levelBadge(c.level)} shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold`}
                      >
                        {c.level}
                      </span>
                    </div>
                    <p className="truncate text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {c.teacher
                        ? `${c.teacher.first_name} ${c.teacher.last_name ?? ''}`
                        : 'Преподаватель не назначен'}
                    </p>
                  </div>

                  {/* Spots */}
                  <div className="shrink-0 text-right">
                    <p
                      className="text-xs font-semibold"
                      style={{
                        color: spots <= 2 ? 'var(--glass-red, #ef4444)' : 'var(--glass-hint)',
                      }}
                    >
                      {spots > 0 ? `${spots} мест` : 'Нет мест'}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--glass-hint)' }}>
                      {c.language.name}
                    </p>
                  </div>

                  {/* Arrow */}
                  <span className="shrink-0 text-xs" style={{ color: 'var(--glass-hint)' }}>
                    ›
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
