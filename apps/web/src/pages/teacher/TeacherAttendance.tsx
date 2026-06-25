/**
 * TeacherAttendance — форма отметки посещаемости урока.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import { useLessonAttendance, useClassStudents, useBulkAttendance } from '../../api/teacher';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

const STATUS_ITEMS: { value: AttendanceStatus; tKey: string; bg: string; color: string }[] = [
  {
    value: 'PRESENT',
    tKey: 'schedule.attendance_PRESENT',
    bg: 'rgba(16,185,129,0.2)',
    color: '#10B981',
  },
  {
    value: 'ABSENT',
    tKey: 'schedule.attendance_ABSENT',
    bg: 'rgba(239,68,68,0.2)',
    color: '#EF4444',
  },
  { value: 'LATE', tKey: 'schedule.attendance_LATE', bg: 'rgba(245,158,11,0.2)', color: '#F59E0B' },
  {
    value: 'EXCUSED',
    tKey: 'schedule.attendance_EXCUSED',
    bg: 'rgba(59,130,246,0.2)',
    color: '#3B82F6',
  },
];

export function TeacherAttendancePage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const classId = searchParams.get('classId') ?? '';

  const studentsQuery = useClassStudents(classId);
  const attendanceQuery = useLessonAttendance(lessonId ?? '');
  const bulkMutation = useBulkAttendance(lessonId ?? '');
  const { t } = useTranslation();

  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});

  useEffect(() => {
    if (attendanceQuery.data && studentsQuery.data) {
      const map: Record<string, AttendanceStatus> = {};
      studentsQuery.data.forEach((s) => (map[s.id] = 'PRESENT'));
      attendanceQuery.data.forEach((a) => (map[a.student_id] = a.status as AttendanceStatus));
      setStatusMap(map);
    }
  }, [attendanceQuery.data, studentsQuery.data]);

  useBackButton(() => navigate(-1));

  const handleAllPresent = () => {
    if (!studentsQuery.data) return;
    const map: Record<string, AttendanceStatus> = {};
    studentsQuery.data.forEach((s) => (map[s.id] = 'PRESENT'));
    setStatusMap(map);
    WebApp.HapticFeedback.impactOccurred('light');
  };

  const handleSave = async () => {
    if (!lessonId || !studentsQuery.data) return;
    const attendances = studentsQuery.data.map((s) => ({
      studentId: s.id,
      status: statusMap[s.id] ?? 'PRESENT',
    }));
    await bulkMutation.mutateAsync({ attendances });
    WebApp.HapticFeedback.notificationOccurred('success');
    navigate(-1);
  };

  const isLoading = studentsQuery.isLoading || attendanceQuery.isLoading;

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

  const students = studentsQuery.data ?? [];

  return (
    <div className="glass-fade-in min-h-screen">
      <div
        className="glass sticky top-0 z-10 px-4 py-4"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">{t('teacher.attendance')}</h1>
            <p className="text-tg-hint text-sm">
              {students.length} {t('teacher.stats_students').toLowerCase()}
            </p>
          </div>
          <button
            onClick={handleAllPresent}
            className="press rounded-xl px-3 py-2 text-xs font-bold"
            style={{ background: 'rgba(16,185,129,0.18)', color: '#10B981' }}
          >
            {t('teacher.all_present')}
          </button>
        </div>
      </div>

      <div className="stagger space-y-3 px-4 pb-32 pt-4">
        {students.map((student) => {
          const current = statusMap[student.id] ?? 'PRESENT';
          return (
            <div key={student.id} className="glass-card rounded-2xl p-4">
              <div className="mb-3 flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{ background: '#6C5CE7' }}
                >
                  {student.first_name[0]}
                  {student.last_name?.[0] ?? ''}
                </div>
                <span className="font-medium">
                  {student.first_name} {student.last_name ?? ''}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {STATUS_ITEMS.map((item) => (
                  <button
                    key={item.value}
                    onClick={() => setStatusMap((p) => ({ ...p, [student.id]: item.value }))}
                    className="press rounded-xl py-2 text-xs font-medium transition-colors"
                    style={{
                      background: current === item.value ? item.bg : 'var(--surface-2)',
                      color: current === item.value ? item.color : 'var(--surface-2)',
                      border: `1.5px solid ${current === item.value ? item.color + '66' : 'var(--surface-2)'}`,
                    }}
                  >
                    {t(item.tKey)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed save button */}
      <div
        className="glass fixed bottom-0 left-0 right-0 px-4 py-4"
        style={{ borderTop: '1px solid var(--hairline)' }}
      >
        <button
          onClick={() => void handleSave()}
          disabled={bulkMutation.isPending || students.length === 0}
          className="glass-btn press w-full rounded-2xl py-4 text-base font-semibold disabled:opacity-50"
        >
          {bulkMutation.isPending ? t('teacher.saving') : t('teacher.save_attendance')}
        </button>
      </div>
    </div>
  );
}
