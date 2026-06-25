'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import Nav from '../../../components/Nav';

interface ClassDetail {
  id: string;
  title: string;
  description: string | null;
  level: string;
  max_students: number;
  language: { name: string; code: string };
  teacher: { first_name: string; last_name: string | null; bio: string | null } | null;
  schedule: { day_of_week: number; starts_at: string; ends_at: string }[];
  _count: { enrollments: number };
}

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

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

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [cls, setCls] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    fetch(`/api/proxy/courses/${id}`)
      .then((r) => r.json())
      .then((d) => setCls(d as ClassDetail))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id, user]);

  async function handleEnroll() {
    setEnrolling(true);
    setMsg('');
    const res = await fetch('/api/proxy/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ class_id: id }),
    });
    setEnrolling(false);
    if (res.ok) {
      setMsg('✅ Вы успешно записаны!');
      setTimeout(() => router.push('/my/lessons'), 1500);
    } else {
      const err = (await res.json()) as { message?: string };
      setMsg(`❌ ${err.message ?? 'Ошибка записи'}`);
    }
  }

  if (loading)
    return (
      <>
        <Nav />
        <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
          <div className="glass-card rounded-3xl px-5 py-12 text-center">
            <p className="text-2xl">⏳</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Загрузка...
            </p>
          </div>
        </main>
      </>
    );

  if (!cls)
    return (
      <>
        <Nav />
        <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
          <div className="glass-card rounded-3xl px-5 py-12 text-center">
            <p className="text-2xl">😕</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Курс не найден
            </p>
          </div>
        </main>
      </>
    );

  const spots = cls.max_students - cls._count.enrollments;
  const flag = FLAG[cls.language.code] ?? '🌐';

  return (
    <>
      <Nav />
      <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: 'var(--glass-accent)' }}
        >
          ← Назад
        </button>

        {/* Hero card */}
        <div className="glass-card rounded-3xl px-5 py-5">
          <div className="mb-3 flex items-start gap-3">
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
              style={{ background: 'var(--glass-green-bg)' }}
            >
              {flag}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h1
                  className="text-lg font-bold leading-tight"
                  style={{ color: 'var(--glass-text)' }}
                >
                  {cls.title}
                </h1>
                <span
                  className={`${levelBadge(cls.level)} shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold`}
                >
                  {cls.level}
                </span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--glass-hint)' }}>
                {cls.language.name}
              </p>
            </div>
          </div>

          {cls.description && (
            <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--glass-text)' }}>
              {cls.description}
            </p>
          )}
        </div>

        {/* Teacher */}
        {cls.teacher && (
          <section>
            <p
              className="mb-2 px-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--glass-hint)' }}
            >
              Преподаватель
            </p>
            <div className="glass-card flex items-center gap-3 rounded-2xl px-4 py-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                style={{ background: 'var(--glass-green-bg)' }}
              >
                👨‍🏫
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--glass-text)' }}>
                  {cls.teacher.first_name} {cls.teacher.last_name ?? ''}
                </p>
                {cls.teacher.bio && (
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--glass-hint)' }}>
                    {cls.teacher.bio}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Schedule */}
        {cls.schedule.length > 0 && (
          <section>
            <p
              className="mb-2 px-1 text-xs font-bold uppercase tracking-widest"
              style={{ color: 'var(--glass-hint)' }}
            >
              Расписание
            </p>
            <div className="glass-section overflow-hidden rounded-2xl">
              {cls.schedule.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom:
                      i < cls.schedule.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-bold"
                    style={{ background: 'var(--glass-green-bg)', color: 'var(--glass-accent)' }}
                  >
                    {DAYS[s.day_of_week]}
                  </span>
                  <p className="text-sm" style={{ color: 'var(--glass-text)' }}>
                    {s.starts_at} – {s.ends_at}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Spots + Enroll */}
        <div className="glass-card rounded-2xl px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--glass-text)' }}>
              Свободных мест
            </p>
            <p
              className="text-sm font-bold"
              style={{ color: spots <= 2 ? 'var(--glass-red, #ef4444)' : 'var(--glass-accent)' }}
            >
              {spots > 0 ? `${spots} / ${cls.max_students}` : 'Нет мест'}
            </p>
          </div>
          <button
            onClick={handleEnroll}
            disabled={enrolling || spots <= 0}
            className="glass-btn w-full rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40"
          >
            {enrolling ? 'Запись...' : spots > 0 ? 'Записаться на курс' : 'Группа заполнена'}
          </button>
          {msg && (
            <p className="mt-3 text-center text-sm" style={{ color: 'var(--glass-hint)' }}>
              {msg}
            </p>
          )}
        </div>
      </main>
    </>
  );
}
