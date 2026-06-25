/**
 * API-хуки для теста на уровень языка (Placement Test).
 *
 * Флоу:
 *  1. POST /placement-tests/start { languageId } → { test_id, questions[] }
 *  2. POST /placement-tests/:id/answer { questionId, answerIndex } → { is_correct }
 *  3. POST /placement-tests/:id/complete → { score, level, correct, total }
 *  4. GET /placement-tests/my → история тестов
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Типы ─────────────────────────────────────────────────────────────────────

export interface PlacementQuestion {
  id: number;
  text: string;
  options: string[];
  level: string; // CEFR: A1 | A2 | B1 | B2 | C1 | C2
}

export interface StartTestResponse {
  test_id: string;
  questions: PlacementQuestion[];
}

export interface AnswerResponse {
  ok: boolean;
  is_correct?: boolean;
  already_answered?: boolean;
}

export interface CompleteResponse {
  score: number;
  level: string; // CEFR
  correct: number;
  total: number;
}

export interface MyTest {
  id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  score: number | null;
  level_assigned: string | null;
  started_at: string;
  completed_at: string | null;
  language: { name_ru: string; flag_emoji: string };
}

// ─── Мутации ──────────────────────────────────────────────────────────────────

/** Начать тест для языка */
export function useStartTest() {
  return useMutation({
    mutationFn: (languageId: string) =>
      apiClient
        .post<StartTestResponse>('/placement-tests/start', { languageId })
        .then((r) => r.data),
  });
}

/** Ответить на вопрос */
export function useAnswerQuestion(testId: string) {
  return useMutation({
    mutationFn: ({ questionId, answerIndex }: { questionId: number; answerIndex: number }) =>
      apiClient
        .post<AnswerResponse>(`/placement-tests/${testId}/answer`, { questionId, answerIndex })
        .then((r) => r.data),
  });
}

/** Завершить тест и получить результат */
export function useCompleteTest(testId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient.post<CompleteResponse>(`/placement-tests/${testId}/complete`).then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['placement-tests-my'] });
    },
  });
}

// ─── Запросы ──────────────────────────────────────────────────────────────────

/** История моих тестов */
export function useMyTests() {
  return useQuery({
    queryKey: ['placement-tests-my'],
    queryFn: () => apiClient.get<MyTest[]>('/placement-tests/my').then((r) => r.data),
    staleTime: 60_000,
  });
}
