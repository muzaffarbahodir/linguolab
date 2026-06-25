/**
 * TeacherPendingHw — список всех ДЗ на проверке учителя.
 * Группировка по классу/заданию, клик → страница submissions.
 */
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '../../hooks/useBackButton';
import { useTeacherPendingHw, type PendingSubmission } from '../../api/teacher';
import { EmptyState } from '../../components/EmptyState';

function fmtDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TeacherPendingHwPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: submissions, isLoading } = useTeacherPendingHw();

  useBackButton(() => navigate('/teacher'));

  // Группируем по homework.id
  const groups = new Map<
    string,
    { hw: PendingSubmission['homework']; items: PendingSubmission[] }
  >();
  for (const sub of submissions ?? []) {
    const key = sub.homework.id;
    if (!groups.has(key)) groups.set(key, { hw: sub.homework, items: [] });
    groups.get(key)!.items.push(sub);
  }

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      {/* Header */}
      <div className="mb-5">
        <p className="text-tg-hint text-xs uppercase tracking-wide">{t('teacher.role_label')}</p>
        <h1 className="shimmer-brand-text text-xl font-bold">{t('teacher.pending_hw_title')}</h1>
        {submissions && submissions.length > 0 && (
          <p className="text-tg-hint mt-0.5 text-xs">
            {t('teacher.works_waiting', { n: submissions.length })}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : groups.size === 0 ? (
        <EmptyState
          emoji="✅"
          title={t('teacher.all_checked')}
          subtitle={t('teacher.no_unchecked')}
        />
      ) : (
        <div className="stagger space-y-4">
          {Array.from(groups.values()).map(({ hw, items }) => (
            <div key={hw.id}>
              {/* Group header */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                  📋 {hw.title}
                </span>
                <span className="text-tg-hint text-xs">· {hw.class.title}</span>
                <span
                  className="ml-auto rounded-full px-1.5 py-0.5 text-xs font-bold"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
                >
                  {items.length}
                </span>
              </div>

              {/* Submissions in group */}
              <div className="space-y-2">
                {items.map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => navigate(`/teacher/homework/${hw.id}/submissions`)}
                    className="press flex w-full items-center gap-3 rounded-xl p-3 text-left"
                    style={{
                      background: 'rgba(245,158,11,0.07)',
                      border: '1px solid rgba(245,158,11,0.15)',
                    }}
                  >
                    {/* Avatar placeholder */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{ background: 'rgba(245,158,11,0.2)', color: '#F59E0B' }}
                    >
                      {sub.student.first_name[0]}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {sub.student.first_name} {sub.student.last_name ?? ''}
                      </p>
                      <p className="text-tg-hint text-xs">
                        {t('teacher.submitted_short', {
                          date: fmtDate(sub.submitted_at, i18n.language),
                        })}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {sub.text_answer && (
                        <span className="text-xs" style={{ color: 'var(--faint)' }}>
                          📝
                        </span>
                      )}
                      {sub.file_url && (
                        <span className="text-xs" style={{ color: 'var(--faint)' }}>
                          📎
                        </span>
                      )}
                      <span className="text-xs" style={{ color: '#F59E0B' }}>
                        →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
