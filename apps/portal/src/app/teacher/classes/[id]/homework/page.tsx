'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import TeacherNav from '../../../../../components/TeacherNav';

interface Submission {
  id: string;
  status: 'SUBMITTED' | 'LATE' | 'GRADED';
  submitted_at: string | null;
  file_url: string | null;
  feedback: string | null;
  grade: number | null;
  student: { first_name: string; last_name: string | null };
}

interface Homework {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  submissions: Submission[];
}

function submissionBadge(status: string) {
  if (status === 'GRADED') return 'glass-option-emerald';
  if (status === 'SUBMITTED') return 'glass-option-blue';
  if (status === 'LATE') return 'glass-option-red';
  return 'glass-option';
}

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Сдано',
  LATE: 'Просрочено',
  GRADED: 'Оценено',
};

export default function TeacherHomeworkPage() {
  const { id } = useParams<{ id: string }>();
  const [homework, setHomework] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newHw, setNewHw] = useState({ title: '', description: '', due_date: '' });

  useEffect(() => {
    fetch(`/api/proxy/teacher/classes/${id}/homework`)
      .then((r) => r.json())
      .then((d) => setHomework(d as Homework[]))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [id]);

  async function grade(submissionId: string, gradeValue: number) {
    setGrading(submissionId);
    const res = await fetch(`/api/proxy/teacher/homework/${submissionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade: gradeValue, feedback: feedback[submissionId] ?? '' }),
    });
    if (res.ok) {
      setHomework((prev) =>
        prev.map((hw) => ({
          ...hw,
          submissions: hw.submissions.map((s) =>
            s.id === submissionId
              ? {
                  ...s,
                  status: 'GRADED' as const,
                  grade: gradeValue,
                  feedback: feedback[submissionId] ?? '',
                }
              : s,
          ),
        })),
      );
    }
    setGrading(null);
  }

  async function createHomework(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch(`/api/proxy/teacher/classes/${id}/homework`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newHw, class_id: id }),
    });
    setCreating(false);
    if (res.ok) {
      const created = (await res.json()) as Homework;
      setHomework((prev) => [{ ...created, submissions: [] }, ...prev]);
      setNewHw({ title: '', description: '', due_date: '' });
      setShowCreate(false);
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
              Домашние задания
            </p>
            <h1 className="text-xl font-bold" style={{ color: 'var(--glass-text)' }}>
              📝 ДЗ
            </h1>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="glass-btn rounded-2xl px-4 py-2.5 text-sm font-bold"
          >
            + Выдать ДЗ
          </button>
        </div>

        {/* Create form */}
        {showCreate && (
          <form onSubmit={createHomework} className="glass-card space-y-3 rounded-2xl px-5 py-4">
            <p className="text-sm font-bold" style={{ color: 'var(--glass-text)' }}>
              Новое задание
            </p>
            <div>
              <label
                className="mb-1 block text-xs font-semibold"
                style={{ color: 'var(--glass-hint)' }}
              >
                Название
              </label>
              <input
                value={newHw.title}
                onChange={(e) => setNewHw((f) => ({ ...f, title: e.target.value }))}
                required
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold"
                style={{ color: 'var(--glass-hint)' }}
              >
                Описание
              </label>
              <textarea
                value={newHw.description}
                onChange={(e) => setNewHw((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                className="mb-1 block text-xs font-semibold"
                style={{ color: 'var(--glass-hint)' }}
              >
                Срок сдачи
              </label>
              <input
                type="datetime-local"
                value={newHw.due_date}
                onChange={(e) => setNewHw((f) => ({ ...f, due_date: e.target.value }))}
                className="glass-input w-full rounded-xl px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={creating}
                className="glass-btn rounded-xl px-5 py-2 text-sm font-bold disabled:opacity-40"
              >
                {creating ? 'Создание...' : 'Выдать'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-sm"
                style={{ color: 'var(--glass-hint)' }}
              >
                Отмена
              </button>
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
        {!loading && homework.length === 0 && (
          <div className="glass rounded-2xl px-4 py-10 text-center">
            <p className="text-2xl">📭</p>
            <p className="mt-2 text-sm" style={{ color: 'var(--glass-hint)' }}>
              Заданий пока нет
            </p>
          </div>
        )}

        {/* HW list */}
        {homework.map((hw) => (
          <div key={hw.id} className="glass-section overflow-hidden rounded-2xl">
            {/* HW header */}
            <div className="px-4 py-3.5" style={{ borderBottom: '1px solid var(--glass-divider)' }}>
              <p className="text-sm font-bold" style={{ color: 'var(--glass-text)' }}>
                {hw.title}
              </p>
              {hw.due_date && (
                <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                  Срок: {new Date(hw.due_date).toLocaleDateString('ru-RU')}
                </p>
              )}
              {hw.description && (
                <p className="mt-0.5 text-xs" style={{ color: 'var(--glass-hint)' }}>
                  {hw.description}
                </p>
              )}
            </div>

            {/* Submissions */}
            {hw.submissions.length === 0 ? (
              <p className="px-4 py-3 text-xs" style={{ color: 'var(--glass-hint)' }}>
                Нет сданных работ
              </p>
            ) : (
              hw.submissions.map((s, si) => (
                <div
                  key={s.id}
                  className="px-4 py-3.5"
                  style={{
                    borderBottom:
                      si < hw.submissions.length - 1 ? '1px solid var(--glass-divider)' : 'none',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold" style={{ color: 'var(--glass-text)' }}>
                        {s.student.first_name} {s.student.last_name ?? ''}
                      </p>
                      {s.file_url && (
                        <a
                          href={s.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs font-medium"
                          style={{ color: 'var(--glass-accent)' }}
                        >
                          📎 Скачать работу →
                        </a>
                      )}

                      {/* Grade form */}
                      {(s.status === 'SUBMITTED' || s.status === 'LATE') && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <label className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                              Оценка (0–100):
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={grades[s.id] ?? ''}
                              onChange={(e) => setGrades((g) => ({ ...g, [s.id]: e.target.value }))}
                              className="glass-input w-20 rounded-lg px-2 py-1 text-sm"
                            />
                          </div>
                          <textarea
                            placeholder="Комментарий (необязательно)"
                            value={feedback[s.id] ?? ''}
                            onChange={(e) => setFeedback((f) => ({ ...f, [s.id]: e.target.value }))}
                            rows={2}
                            className="glass-input w-full rounded-xl px-3 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => grade(s.id, Number(grades[s.id] ?? 0))}
                            disabled={grading === s.id || grades[s.id] === undefined}
                            className="glass-option-emerald rounded-xl px-3 py-1.5 text-xs font-bold disabled:opacity-40"
                          >
                            ✅ Выставить оценку
                          </button>
                        </div>
                      )}

                      {/* Graded info */}
                      {s.status === 'GRADED' && (
                        <div className="mt-1">
                          <p
                            className="text-xs font-semibold"
                            style={{ color: 'var(--glass-accent)' }}
                          >
                            Оценка: {s.grade}/100
                          </p>
                          {s.feedback && (
                            <p className="text-xs" style={{ color: 'var(--glass-hint)' }}>
                              💬 {s.feedback}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <span
                      className={`${submissionBadge(s.status)} shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold`}
                    >
                      {STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        ))}
      </main>
    </>
  );
}
