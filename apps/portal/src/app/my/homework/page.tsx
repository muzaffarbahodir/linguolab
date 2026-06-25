'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../components/AuthProvider';
import Nav from '../../../components/Nav';

interface Homework {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  feedback: string | null;
  lesson: { title: string; class: { title: string } };
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Ожидает',
  SUBMITTED: 'Сдано',
  APPROVED: 'Принято',
  REJECTED: 'Отклонено',
};

const STATUS_ICON: Record<string, string> = {
  PENDING: '⏳',
  SUBMITTED: '📤',
  APPROVED: '✅',
  REJECTED: '❌',
};

function statusClass(status: string) {
  if (status === 'APPROVED') return 'glass-option-emerald';
  if (status === 'SUBMITTED') return 'glass-option-blue';
  if (status === 'REJECTED') return 'glass-option-red';
  return 'glass-option';
}

export default function HomeworkPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/proxy/homework')
      .then((r) => r.json())
      .then((d) => setItems(d as Homework[]))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [user]);

  async function handleSubmit(hwId: string, file: File) {
    setUploading(hwId);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/proxy/homework/${hwId}`, {
      method: 'PATCH',
      body: form,
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((h) => (h.id === hwId ? { ...h, status: 'SUBMITTED' as const } : h)),
      );
    }
    setUploading(null);
    setActiveId(null);
  }

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
            Задания
          </p>
          <h1 className="text-xl font-bold" style={{ color: 'var(--glass-text)' }}>
            📝 Домашние задания
          </h1>
          {!loading && (
            <p className="mt-0.5 text-sm" style={{ color: 'var(--glass-hint)' }}>
              {items.length > 0 ? `${items.length} заданий` : 'Заданий пока нет'}
            </p>
          )}
        </div>

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
        {!loading && items.length === 0 && (
          <div className="glass rounded-2xl px-4 py-10 text-center">
            <p className="text-2xl">📭</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Заданий пока нет
            </p>
          </div>
        )}

        {/* List */}
        {items.length > 0 && (
          <div className="glass-section overflow-hidden rounded-2xl">
            {items.map((hw, i) => (
              <div
                key={hw.id}
                className="px-4 py-4"
                style={{
                  borderBottom: i < items.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--glass-text)' }}>
                      {hw.title}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--glass-hint)' }}>
                      {hw.lesson.class.title} · {hw.lesson.title}
                    </p>
                    {hw.due_date && (
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--glass-hint)' }}>
                        Срок: {new Date(hw.due_date).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </div>
                  <span
                    className={`${statusClass(hw.status)} shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold`}
                  >
                    {STATUS_ICON[hw.status]} {STATUS_LABEL[hw.status]}
                  </span>
                </div>

                {/* Description */}
                {hw.description && (
                  <p
                    className="mt-2 text-xs leading-relaxed"
                    style={{ color: 'var(--glass-text)' }}
                  >
                    {hw.description}
                  </p>
                )}

                {/* Feedback */}
                {hw.feedback && (
                  <div
                    className="mt-2 rounded-xl px-3 py-2 text-xs"
                    style={{ background: 'var(--glass-green-bg)', color: 'var(--glass-hint)' }}
                  >
                    💬 {hw.feedback}
                  </div>
                )}

                {/* Submit button */}
                {hw.status === 'PENDING' && (
                  <div className="mt-3">
                    {activeId === hw.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileRef}
                          type="file"
                          className="text-xs"
                          style={{ color: 'var(--glass-hint)' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void handleSubmit(hw.id, f);
                          }}
                        />
                        {uploading === hw.id && (
                          <span className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                            Загрузка...
                          </span>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => setActiveId(hw.id)}
                        className="glass-btn rounded-xl px-4 py-2 text-xs font-bold"
                      >
                        Сдать задание
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
