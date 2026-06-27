import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useTeacherStudentOverview,
  useTeacherStudentAttendance,
  useTeacherStudentHomework,
} from '../../api/parents';
import { OverviewContent, AttendanceContent, HomeworkContent } from '../parent/ParentChild';
import { EmptyState } from '../../components/EmptyState';

type Tab = 'overview' | 'attendance' | 'homework';

export function TeacherStudentPage() {
  const { t } = useTranslation();
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');

  const overviewQuery = useTeacherStudentOverview(classId ?? '', studentId ?? '');
  const attendanceQuery = useTeacherStudentAttendance(classId ?? '', studentId ?? '');
  const homeworkQuery = useTeacherStudentHomework(classId ?? '', studentId ?? '');

  useBackButton(() => navigate(-1));

  const studentName = overviewQuery.data
    ? `${overviewQuery.data.child.first_name} ${overviewQuery.data.child.last_name ?? ''}`.trim()
    : t('profile.role_student');

  const Spinner = () => (
    <div className="flex justify-center py-16">
      <div
        className="h-7 w-7 animate-spin rounded-full border-4 border-t-transparent"
        style={{ borderColor: 'rgba(99,102,241,0.3)', borderTopColor: '#6366f1' }}
      />
    </div>
  );

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: t('teacher.tab_overview'), icon: '📊' },
    { id: 'attendance', label: t('teacher.tab_visits'), icon: '📅' },
    { id: 'homework', label: t('teacher.tab_hw'), icon: '📚' },
  ];

  return (
    <div className="glass-fade-in min-h-screen pb-8">
      {/* Header */}
      <div
        className="px-4 pb-3 pt-6"
        style={{ background: 'rgba(22,32,46,0.95)', backdropFilter: 'blur(12px)' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h1 className="text-lg font-bold">{studentName}</h1>
            {overviewQuery.data && (
              <p className="text-xs" style={{ color: 'var(--faint)' }}>
                {t('profile.role_student')} ·{' '}
                {t('parent.active_classes_count', {
                  n: overviewQuery.data.child.active_classes.length,
                })}
              </p>
            )}
          </div>
          {/* Teacher badge */}
          <div
            className="rounded-xl px-3 py-1.5 text-xs font-medium"
            style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}
          >
            {t('teacher.role_label')}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="press flex-1 rounded-xl py-2 text-xs font-semibold transition-colors"
              style={
                tab === t.id
                  ? { background: '#6366f1', color: '#fff' }
                  : { background: 'var(--surface-2)', color: 'var(--muted)' }
              }
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {tab === 'overview' &&
          (overviewQuery.isLoading ? (
            <Spinner />
          ) : overviewQuery.isError || !overviewQuery.data ? (
            <EmptyState emoji="⚠️" title={t('parent.load_error')} />
          ) : (
            <OverviewContent data={overviewQuery.data} />
          ))}

        {tab === 'attendance' &&
          (attendanceQuery.isLoading ? (
            <Spinner />
          ) : (
            <AttendanceContent data={attendanceQuery.data ?? []} />
          ))}

        {tab === 'homework' &&
          (homeworkQuery.isLoading ? (
            <Spinner />
          ) : (
            <HomeworkContent data={homeworkQuery.data ?? []} />
          ))}
      </div>
    </div>
  );
}
