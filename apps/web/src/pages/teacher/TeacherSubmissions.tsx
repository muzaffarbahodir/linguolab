/**
 * TeacherSubmissions — список сданных работ по ДЗ + выставление оценок.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import { useHomeworkSubmissions, useGradeSubmission } from '../../api/teacher';
import { EmptyState } from '../../components/EmptyState';

const inputCls =
  'w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-violet-500';
const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--hairline)',
  color: 'inherit',
};

export function TeacherSubmissionsPage() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const navigate = useNavigate();

  const { t, i18n } = useTranslation();
  const { data: submissions, isLoading } = useHomeworkSubmissions(homeworkId ?? '');
  const gradeMutation = useGradeSubmission(homeworkId ?? '');

  const [gradingId, setGradingId] = useState<string | null>(null);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');

  useBackButton(() => navigate(-1));

  const handleGrade = async () => {
    if (!gradingId || !grade) return;
    const g = parseInt(grade, 10);
    if (isNaN(g) || g < 0 || g > 100) return;
    await gradeMutation.mutateAsync({
      submissionId: gradingId,
      payload: { grade: g, feedback: feedback || undefined },
    });
    WebApp.HapticFeedback.notificationOccurred('success');
    setGradingId(null);
    setGrade('');
    setFeedback('');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          className="h-7 w-7 animate-spin rounded-full border-4 border-t-transparent"
          style={{ borderColor: 'rgba(108,92,231,0.3)', borderTopColor: '#6C5CE7' }}
        />
      </div>
    );
  }

  const list = submissions ?? [];

  return (
    <div className="glass-fade-in min-h-screen">
      <div
        className="glass sticky top-0 z-10 px-4 py-4"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <h1 className="text-lg font-bold">{t('teacher.submissions')}</h1>
        <p className="text-tg-hint text-sm">{list.length}</p>
      </div>

      <div className="stagger space-y-3 px-4 pb-8 pt-4">
        {list.length === 0 && <EmptyState emoji="📭" title={t('teacher.no_works')} />}

        {list.map((sub) => (
          <div key={sub.id} className="glass-card rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">
                {sub.student.first_name} {sub.student.last_name ?? ''}
              </span>
              {sub.status === 'GRADED' ? (
                <span
                  className="rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{ background: 'rgba(16,185,129,0.2)', color: '#10B981' }}
                >
                  {t('teacher.graded', { grade: sub.grade })}
                </span>
              ) : (
                <span
                  className="rounded-full px-3 py-0.5 text-xs font-semibold"
                  style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}
                >
                  {t('teacher.not_graded')}
                </span>
              )}
            </div>

            <p className="text-tg-hint mb-1 text-xs">
              {t('teacher.submitted_at')}{' '}
              {new Date(sub.submitted_at).toLocaleString(i18n.language, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>

            {sub.text_answer && (
              <p className="mt-2 rounded-xl p-3 text-sm" style={{ background: 'var(--surface-2)' }}>
                {sub.text_answer}
              </p>
            )}

            {sub.file_url && (
              <a
                href={sub.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block text-sm underline"
                style={{ color: '#8B5CF6' }}
              >
                {t('teacher.open_file')}
              </a>
            )}

            {sub.status === 'GRADED' && sub.feedback && (
              <p className="text-tg-hint mt-2 text-xs italic">
                {t('teacher.comment', { text: sub.feedback })}
              </p>
            )}

            {sub.status !== 'GRADED' && (
              <button
                onClick={() => {
                  setGradingId(sub.id);
                  setGrade('');
                  setFeedback('');
                }}
                className="glass-btn press mt-3 w-full rounded-xl py-2.5 text-sm font-semibold"
                style={{ background: '#8B5CF6' }}
              >
                {t('teacher.set_grade')}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Grade modal */}
      {gradingId && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div className="glass-card w-full rounded-t-3xl p-6">
            <h3 className="mb-4 text-center text-lg font-semibold">{t('teacher.grade_title')}</h3>

            <label className="text-tg-hint mb-1 block text-sm font-medium">
              {t('teacher.grade_label')}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder={t('teacher.grade_ph')}
              className={`mb-3 ${inputCls}`}
              style={inputStyle}
            />

            <label className="text-tg-hint mb-1 block text-sm font-medium">
              {t('teacher.feedback_label')}
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
              placeholder={t('teacher.feedback_ph')}
              className={`mb-4 resize-none ${inputCls}`}
              style={inputStyle}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setGradingId(null)}
                className="glass-option press flex-1 rounded-xl py-3 text-sm"
              >
                {t('teacher.grade_cancel')}
              </button>
              <button
                onClick={() => void handleGrade()}
                disabled={!grade || gradeMutation.isPending}
                className="glass-btn press flex-1 rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
                style={{ background: '#8B5CF6' }}
              >
                {gradeMutation.isPending ? t('teacher.grade_saving') : t('teacher.grade_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
