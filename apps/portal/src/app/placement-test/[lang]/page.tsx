'use client';

import { useAuth } from '../../../components/AuthProvider';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Nav from '../../../components/Nav';

interface Question {
  id: number;
  text: string;
  options: string[];
  level: string;
}

interface TestStart {
  test_id: string;
  questions: Question[];
}

interface TestResult {
  score: number;
  level: string;
  correct: number;
  total: number;
}

const CEFR_DESC: Record<string, string> = {
  A1: 'Начинающий',
  A2: 'Элементарный',
  B1: 'Средний',
  B2: 'Выше среднего',
  C1: 'Продвинутый',
  C2: 'Мастер',
};

export default function PlacementTestPage() {
  const { lang } = useParams<{ lang: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const [test, setTest] = useState<TestStart | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/proxy/placement-tests/start?lang=${lang}`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => setTest(d as TestStart))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [lang, user]);

  async function handleAnswer(questionId: number, answerIndex: number) {
    if (answers[questionId] !== undefined || !test) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));

    await fetch(`/api/proxy/placement-tests/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        test_id: test.test_id,
        question_id: questionId,
        answer_index: answerIndex,
      }),
    });

    if (current < (test.questions.length ?? 0) - 1) {
      setTimeout(() => setCurrent((c) => c + 1), 400);
    }
  }

  async function handleComplete() {
    if (!test) return;
    setSubmitting(true);
    const res = await fetch(`/api/proxy/placement-tests/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test_id: test.test_id }),
    });
    const data = (await res.json()) as TestResult;
    setResult(data);
    setSubmitting(false);
  }

  const allAnswered = test ? test.questions.every((q) => answers[q.id] !== undefined) : false;

  if (loading)
    return (
      <>
        <Nav />
        <div className="flex h-64 items-center justify-center text-gray-400">Загрузка теста...</div>
      </>
    );

  if (result)
    return (
      <>
        <Nav />
        <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
            <p className="text-5xl font-bold text-indigo-600">{result.level}</p>
            <p className="mt-1 text-lg text-gray-500">{CEFR_DESC[result.level]}</p>
            <p className="mt-4 text-sm text-gray-400">
              Правильных ответов: {result.correct} из {result.total} ({result.score}%)
            </p>
            <button
              onClick={() => router.push('/courses')}
              className="mt-6 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Подобрать курс →
            </button>
          </div>
        </main>
      </>
    );

  if (!test)
    return (
      <>
        <Nav />
        <div className="flex h-64 items-center justify-center text-gray-400">Ошибка загрузки</div>
      </>
    );

  const q = test.questions[current];
  const progress = Math.round((Object.keys(answers).length / test.questions.length) * 100);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-500">
            <span>
              Вопрос {current + 1} из {test.questions.length}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-1 text-xs font-semibold uppercase text-indigo-400">{q.level}</p>
          <p className="mb-6 text-lg font-medium text-gray-900">{q.text}</p>

          <ul className="space-y-2">
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === i;
              return (
                <li key={i}>
                  <button
                    onClick={() => handleAnswer(q.id, i)}
                    disabled={answers[q.id] !== undefined}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
                    } disabled:cursor-default`}
                  >
                    {opt}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-4 flex justify-between">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={current === 0}
            className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            ← Назад
          </button>

          {allAnswered ? (
            <button
              onClick={handleComplete}
              disabled={submitting}
              className="rounded-xl bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Обработка...' : 'Завершить тест'}
            </button>
          ) : (
            <button
              onClick={() => setCurrent((c) => Math.min(test.questions.length - 1, c + 1))}
              disabled={answers[q.id] === undefined || current === test.questions.length - 1}
              className="rounded-lg px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-30"
            >
              Следующий →
            </button>
          )}
        </div>
      </main>
    </>
  );
}
