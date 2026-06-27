/**
 * PlacementTest — тест на определение уровня языка.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useBackButton } from '../hooks/useBackButton';
import { useLanguages } from '../api/languages';
import {
  useStartTest,
  useAnswerQuestion,
  useCompleteTest,
  PlacementQuestion,
  CompleteResponse,
} from '../api/placement-tests';
import { toast } from '../store/toast';

type Screen = 'language_select' | 'in_progress' | 'result';

const LEVEL_BG: Record<string, string> = {
  A1: 'var(--surface-2)',
  A2: 'rgba(16,185,129,0.2)',
  B1: 'rgba(59,130,246,0.2)',
  B2: 'rgba(99,102,241,0.2)',
  C1: 'rgba(129,140,248,0.2)',
  C2: 'rgba(245,158,11,0.2)',
};
const LEVEL_COLOR: Record<string, string> = {
  A1: 'var(--surface-2)',
  A2: '#10B981',
  B1: '#3B82F6',
  B2: '#6366F1',
  C1: '#818cf8',
  C2: '#F59E0B',
};
export function PlacementTestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [screen, setScreen] = useState<Screen>('language_select');
  const [selectedLanguageId, setSelectedLanguageId] = useState('');
  const [testId, setTestId] = useState('');
  const [questions, setQuestions] = useState<PlacementQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<CompleteResponse | null>(null);
  const [answeredCorrectly, setAnsweredCorrectly] = useState<boolean | null>(null);

  const { data: languages } = useLanguages();
  const startMutation = useStartTest();
  const answerMutation = useAnswerQuestion(testId);
  const completeMutation = useCompleteTest(testId);

  useBackButton(() => {
    if (screen === 'in_progress' || screen === 'result') {
      navigate('/');
    } else {
      navigate(-1);
    }
  });

  const handleSelectLanguage = async (languageId: string) => {
    setSelectedLanguageId(languageId);
    WebApp.HapticFeedback.selectionChanged();
    try {
      const data = await startMutation.mutateAsync(languageId);
      setTestId(data.test_id);
      setQuestions(data.questions);
      setCurrentIdx(0);
      setSelected(null);
      setAnsweredCorrectly(null);
      setScreen('in_progress');
    } catch {
      toast.error(t('placement.error_start'));
    }
  };

  const currentQuestion = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;

  const handleAnswer = async (optionIdx: number) => {
    if (answerMutation.isPending || selected !== null || currentQuestion == null) return;
    setSelected(optionIdx);

    try {
      const res = await answerMutation.mutateAsync({
        questionId: currentQuestion.id,
        answerIndex: optionIdx,
      });
      setAnsweredCorrectly(res.is_correct ?? null);
      WebApp.HapticFeedback.impactOccurred(res.is_correct ? 'light' : 'heavy');
    } catch {
      setAnsweredCorrectly(null);
    }

    setTimeout(async () => {
      if (isLast) {
        try {
          const completeData = await completeMutation.mutateAsync();
          setResult(completeData);
          setScreen('result');
          WebApp.HapticFeedback.notificationOccurred('success');
        } catch {
          toast.error(t('placement.error_complete'));
        }
      } else {
        setCurrentIdx((p) => p + 1);
        setSelected(null);
        setAnsweredCorrectly(null);
      }
    }, 700);
  };

  // ── LANGUAGE SELECT ──────────────────────────────────────────────────────────

  if (screen === 'language_select') {
    return (
      <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold">{t('placement.page_title')}</h1>
          <p className="text-tg-hint mt-1 text-sm">{t('placement.page_subtitle')}</p>
        </div>

        <div className="glass-violet mb-5 rounded-2xl p-4">
          <p className="text-sm text-white/85">{t('placement.intro_tip')}</p>
        </div>

        <h2 className="text-tg-hint mb-3 text-sm font-semibold uppercase tracking-wide">
          {t('placement.select_lang')}
        </h2>

        <div className="stagger space-y-2">
          {(languages ?? []).map((lang) => (
            <button
              key={lang.id}
              onClick={() => void handleSelectLanguage(lang.id)}
              disabled={startMutation.isPending}
              className="glass-card press flex w-full items-center gap-4 rounded-2xl p-4 text-left disabled:opacity-50"
            >
              <span className="text-3xl">{lang.flag_emoji}</span>
              <div className="flex-1">
                <p className="font-semibold">{lang.name_ru}</p>
                <p className="text-tg-hint text-xs">{t('placement.test_meta')}</p>
              </div>
              <span className="text-tg-hint">→</span>
            </button>
          ))}
        </div>

        {startMutation.isPending && (
          <div className="mt-6 flex justify-center">
            <div className="border-brand/30 border-t-brand h-6 w-6 animate-spin rounded-full border-4" />
          </div>
        )}
      </div>
    );
  }

  // ── IN PROGRESS ──────────────────────────────────────────────────────────────

  if (screen === 'in_progress' && currentQuestion != null) {
    const progress = ((currentIdx + 1) / questions.length) * 100;

    return (
      <div className="glass-fade-in min-h-screen">
        {/* Header + progress */}
        <div className="glass border-surface-2 sticky top-0 z-10 border-b px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-tg-hint text-sm font-medium">
              {currentIdx + 1} / {questions.length}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: LEVEL_BG[currentQuestion.level] ?? 'var(--surface-2)',
                color: LEVEL_COLOR[currentQuestion.level] ?? 'var(--surface-2)',
              }}
            >
              {currentQuestion.level}
            </span>
          </div>
          <div className="bg-hairline h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg,#6366f1,#818cf8)',
              }}
            />
          </div>
        </div>

        <div className="px-4 pb-8 pt-6">
          {/* Question */}
          <div className="glass-card mb-6 rounded-2xl p-5">
            <p className="text-base font-medium">{currentQuestion.text}</p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              let bg = 'var(--surface-2)';
              let border = 'var(--surface-2)';
              let color = 'inherit';

              if (selected !== null && idx === selected) {
                if (answeredCorrectly === true) {
                  bg = 'rgba(16,185,129,0.2)';
                  border = '#10B981';
                  color = '#10B981';
                } else {
                  bg = 'rgba(239,68,68,0.2)';
                  border = '#EF4444';
                  color = '#EF4444';
                }
              } else if (selected !== null) {
                bg = 'var(--surface-2)';
                border = 'var(--surface-2)';
                color = 'var(--surface-2)';
              }

              return (
                <button
                  key={idx}
                  onClick={() => void handleAnswer(idx)}
                  disabled={selected !== null || answerMutation.isPending}
                  className="w-full rounded-2xl p-4 text-left text-sm font-medium transition-all"
                  style={{ background: bg, border: `2px solid ${border}`, color }}
                >
                  <span className="text-faint mr-3 font-bold">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULT ───────────────────────────────────────────────────────────────────

  if (screen === 'result' && result) {
    const levelColor = LEVEL_COLOR[result.level] ?? 'var(--surface-2)';
    const levelBg = LEVEL_BG[result.level] ?? 'var(--surface-2)';
    const levelDescKey = `placement.level_${result.level}` as const;
    const levelDesc = t(levelDescKey, { defaultValue: result.level });

    return (
      <div className="glass-fade-in flex min-h-screen flex-col px-4 pb-10 pt-10">
        <div className="mx-auto w-full max-w-sm text-center">
          <div className="floral-float mb-2 text-6xl">🎉</div>
          <h1 className="mb-2 text-2xl font-bold">{t('placement.result_title')}</h1>
          <p className="text-tg-hint mb-6 text-sm">
            {t('placement.result_correct', { correct: result.correct, total: result.total })}
          </p>

          {/* Level badge */}
          <div
            className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full px-6 py-3 text-2xl font-black"
            style={{ background: levelBg, color: levelColor, border: `2px solid ${levelColor}44` }}
          >
            {result.level}
          </div>
          <p className="mb-1 text-lg font-semibold">{levelDesc}</p>
          <p className="text-tg-hint mb-6 text-sm">
            {t('placement.result_score', { score: result.score })}
          </p>

          {/* Score bar */}
          <div className="bg-hairline mb-8 h-3 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${result.score}%`,
                background: `linear-gradient(90deg, ${levelColor}, ${levelColor}88)`,
              }}
            />
          </div>

          <p className="text-tg-hint mb-6 text-sm">{t('placement.result_advice')}</p>

          <button
            onClick={() => navigate('/book')}
            className="glass-btn press mb-3 w-full rounded-2xl py-4 text-base font-bold"
          >
            {t('placement.enroll_btn')}
          </button>
          <button
            onClick={() => navigate('/')}
            className="glass-option press w-full rounded-2xl py-3 text-sm"
          >
            {t('placement.home_btn')}
          </button>
        </div>
      </div>
    );
  }

  // ── Нет вопросов ─────────────────────────────────────────────────────────────

  if (screen === 'in_progress' && questions.length === 0) {
    return (
      <div className="glass-fade-in flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="mb-2 text-4xl">📭</p>
        <p className="mb-1 font-semibold">{t('placement.no_questions')}</p>
        <p className="text-tg-hint mb-4 text-sm">{t('placement.no_questions_sub')}</p>
        <button
          onClick={() => setScreen('language_select')}
          className="glass-btn press rounded-xl px-6 py-2 text-sm"
        >
          {t('placement.choose_other')}
        </button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        className="h-7 w-7 animate-spin rounded-full border-4 border-t-transparent"
        style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#6366f1' }}
      />
    </div>
  );
}
