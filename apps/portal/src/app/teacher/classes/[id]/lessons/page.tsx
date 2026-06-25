'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import TeacherNav from '../../../../../components/TeacherNav';

interface Lesson {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  is_completed: boolean;
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

export default function TeacherLessonsPage() {
  const { id } = useParams<{ id: string }>();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', starts_at: '', ends_at: '' });
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`/api/proxy/teacher/classes/${id}/lessons`)
      .then((r) => r.json())
      .then((d) => setLessons(d as Lesson[]))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMsg('');
    const res = await fetch(`/api/proxy/teacher/classes/${id}/lessons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, class_id: id }),
    });
    setCreating(false);
    if (res.ok) {
      const lesson = (await res.json()) as Lesson;
      setLessons((prev) => [lesson, ...prev]);
      setForm({ title: '', starts_at: '', ends_at: '' });
      setShowForm(false);
    } else {
      setMsg('❌ Ошибка создания урока');
    }
  }

  return (
    <>
      <TeacherNav />
      <main className="glass-fade-in mx-auto max-w-lg space-y-4 px-4 py-4">
        {/* Back */}
        <Link
          href={`/teacher/classes/${id}`}
          className="flex items-center gap-1 text-xs font-semibold"
          style={{ color: 'var(--glass-accent)' }}
        >
          ← К классу
        </Link>

        {/* Header */}
        <div className="glass-emerald flex items-center justify-between rounded-3xl px-5 py-5">
          <div>
            <p
              className="mb-1 text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--glass-accent)' }}
            >
              Управление
            </p>
            <h1 className="text-xl font-bold" style={{ color: 'var(--glass-text)' }}>
              📅 Уроки
            </h1>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="glass-btn rounded-2xl px-4 py-2.5 text-sm font-bold"
          >
            + Добавить
          </button>
        </div>

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="glass-card space-y-3 rounded-2xl px-5 py-4">
            <p className="text-sm font-bold" style={{ color: 'var(--glass-text)' }}>
              Новый урок
            </p>
            <div>
              <label
                className="mb-1 block text-xs font-semibold"
                style={{ color: 'var(--glass-hint)' }}
              >
                Название
              </label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
                placeholder="Урок 1 — Введение"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  className="mb-1 block text-xs font-semibold"
                  style={{ color: 'var(--glass-hint)' }}
                >
                  Начало
                </label>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  required
                  className="glass-input w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-xs font-semibold"
                  style={{ color: 'var(--glass-hint)' }}
                >
                  Конец
                </label>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  required
                  className="glass-input w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="glass-btn rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-40"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm"
                style={{ color: 'var(--glass-hint)' }}
              >
                Отмена
              </button>
              {msg && (
                <span className="text-sm" style={{ color: 'var(--glass-hint)' }}>
                  {msg}
                </span>
              )}
            </div>
          </form>
        )}

        {/* Loading */}
        {loading && (
          <div className="glass rounded-2xl px-4 py-10 text-center">
            <p className="text-2xl">⏳</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Загрузка...
            </p>
          </div>
        )}

        {/* Empty */}
        {!loading && lessons.length === 0 && (
          <div className="glass rounded-2xl px-4 py-10 text-center">
            <p className="text-2xl">📭</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Уроков пока нет
            </p>
          </div>
        )}

        {/* List */}
        {lessons.length > 0 && (
          <div className="glass-section overflow-hidden rounded-2xl">
            {lessons.map((l, i) => (
              <div
                key={l.id}
                className="flex items-start gap-3 px-4 py-3.5"
                style={{
                  borderBottom: i < lessons.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  opacity: l.is_completed ? 0.7 : 1,
                }}
              >
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base"
                  style={{ background: 'var(--glass-green-bg)' }}
                >
                  {l.is_completed ? '✓' : '🕐'}
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
                  {l.description && (
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {l.description}
                    </p>
                  )}
                </div>
                {l.is_completed ? (
                  <span className="glass-option shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    Проведён
                  </span>
                ) : (
                  <span className="glass-option-emerald shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                    Скоро
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
