/**
 * TeacherClass — детальная страница класса.
 * Три вкладки: Уроки | Студенты | Домашние задания.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useClassLessons,
  useClassStudents,
  useClassHomework,
  useClassStudentStats,
  useCreateLesson,
  useCreateHomework,
  useGenerateLessons,
} from '../../api/teacher';

type Tab = 'lessons' | 'students' | 'homework';

// STATUS_LABEL теперь через t('teacher.status_*') в компоненте
const STATUS_BG: Record<string, string> = {
  SCHEDULED: 'rgba(59,130,246,0.2)',
  COMPLETED: 'rgba(16,185,129,0.2)',
  CANCELLED: 'var(--surface-2)',
};
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: '#3B82F6',
  COMPLETED: '#10B981',
  CANCELLED: 'var(--surface-2)',
};

const inputCls =
  'w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-violet-500';
const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--hairline)',
  color: 'inherit',
};

export function TeacherClassPage() {
  const { t, i18n } = useTranslation();
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('lessons');
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [showAddHw, setShowAddHw] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateWeeks, setGenerateWeeks] = useState(4);
  const [generateResult, setGenerateResult] = useState<{ created: number; skipped: number } | null>(
    null,
  );

  const [lessonDate, setLessonDate] = useState('');
  const [lessonTime, setLessonTime] = useState('');
  const [lessonTitle, setLessonTitle] = useState('');
  const [hwTitle, setHwTitle] = useState('');
  const [hwDesc, setHwDesc] = useState('');
  const [hwDue, setHwDue] = useState('');

  const lessonsQuery = useClassLessons(classId ?? '');
  const studentsQuery = useClassStudents(classId ?? '');
  const studentStatsQuery = useClassStudentStats(classId ?? '');
  const hwQuery = useClassHomework(classId ?? '');
  const createLesson = useCreateLesson(classId ?? '');
  const createHw = useCreateHomework(classId ?? '');
  const generateLessons = useGenerateLessons(classId ?? '');

  useBackButton(() => navigate('/teacher'));

  const handleAddLesson = async () => {
    if (!lessonDate || !lessonTime || !classId) return;
    const scheduledAt = new Date(`${lessonDate}T${lessonTime}:00`).toISOString();
    await createLesson.mutateAsync({ classId, title: lessonTitle || undefined, scheduledAt });
    setShowAddLesson(false);
    setLessonDate('');
    setLessonTime('');
    setLessonTitle('');
  };

  const handleGenerate = async () => {
    const result = await generateLessons.mutateAsync(generateWeeks);
    setGenerateResult(result);
    WebApp.HapticFeedback.notificationOccurred('success');
  };

  const handleAddHw = async () => {
    if (!hwTitle || !classId) return;
    await createHw.mutateAsync({
      class_id: classId,
      title: hwTitle,
      description: hwDesc || undefined,
      due_date: hwDue || undefined,
    });
    setShowAddHw(false);
    setHwTitle('');
    setHwDesc('');
    setHwDue('');
  };

  return (
    <div className="glass-fade-in min-h-screen pb-8">
      {/* Tabs */}
      <div
        className="glass sticky top-0 z-10 flex"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        {(['lessons', 'students', 'homework'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className="press flex-1 py-3 text-sm font-medium transition-colors"
            style={{
              color: tab === tabKey ? '#6C5CE7' : 'var(--surface-2)',
              borderBottom: tab === tabKey ? '2px solid #6C5CE7' : '2px solid transparent',
            }}
          >
            {tabKey === 'lessons'
              ? t('teacher.tab_lessons')
              : tabKey === 'students'
                ? t('teacher.tab_students')
                : t('teacher.tab_hw')}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">
        {/* ── LESSONS ── */}
        {tab === 'lessons' && (
          <div>
            {/* Generate result banner */}
            {generateResult && (
              <div
                className="mb-3 flex items-center gap-2 rounded-xl p-3"
                style={{
                  background:
                    generateResult.created > 0 ? 'rgba(16,185,129,0.12)' : 'var(--surface-2)',
                  border: `1px solid ${generateResult.created > 0 ? 'rgba(16,185,129,0.25)' : 'var(--surface-2)'}`,
                }}
              >
                <span className="text-lg">{generateResult.created > 0 ? '✅' : 'ℹ️'}</span>
                <div className="flex-1 text-xs">
                  {generateResult.created > 0 ? (
                    <span style={{ color: '#10B981' }}>
                      {t('teacher.generated_ok', { n: generateResult.created })}
                      {generateResult.skipped > 0 &&
                        t('teacher.generated_skipped', { n: generateResult.skipped })}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>
                      {t('teacher.generated_all_exist', { n: generateResult.skipped })}
                    </span>
                  )}
                </div>
                <button onClick={() => setGenerateResult(null)} className="text-xs opacity-50">
                  ✕
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowGenerate(true)}
                className="press rounded-xl py-3 text-sm font-semibold"
                style={{ background: 'rgba(59,130,246,0.18)', color: '#3B82F6' }}
              >
                {t('teacher.auto_generate')}
              </button>
              <button
                onClick={() => setShowAddLesson(true)}
                className="glass-btn press rounded-xl py-3 text-sm font-semibold"
              >
                {t('teacher.add_lesson')}
              </button>
            </div>

            {lessonsQuery.isLoading ? (
              <div className="flex justify-center pt-8">
                <div
                  className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent"
                  style={{ borderColor: 'rgba(108,92,231,0.3)', borderTopColor: '#6C5CE7' }}
                />
              </div>
            ) : (
              <div className="stagger space-y-3">
                {(lessonsQuery.data ?? []).map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() =>
                      navigate(`/teacher/lesson/${lesson.id}/attendance?classId=${classId ?? ''}`)
                    }
                    className="glass-card press w-full rounded-2xl p-4 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          {lesson.title ?? t('teacher.lesson_no_title')}
                        </p>
                        <p className="text-tg-hint mt-0.5 text-xs">
                          {new Date(lesson.scheduled_at).toLocaleString(i18n.language, {
                            day: 'numeric',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Tashkent',
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: STATUS_BG[lesson.status] ?? 'var(--surface-2)',
                            color: STATUS_COLOR[lesson.status] ?? 'var(--surface-2)',
                          }}
                        >
                          {lesson.status === 'SCHEDULED'
                            ? t('teacher.status_scheduled')
                            : lesson.status === 'COMPLETED'
                              ? t('teacher.status_completed')
                              : t('teacher.status_cancelled')}
                        </span>
                        {lesson._count != null && lesson.status === 'COMPLETED' && (
                          <span className="text-tg-hint text-xs">
                            👥 {lesson._count.attendances}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {(lessonsQuery.data ?? []).length === 0 && (
                  <p className="text-tg-hint pt-4 text-center text-sm">
                    {t('teacher.no_lessons_list')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STUDENTS ── */}
        {tab === 'students' && (
          <div className="space-y-2">
            {studentStatsQuery.isLoading || studentsQuery.isLoading ? (
              <div className="flex justify-center pt-8">
                <div
                  className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent"
                  style={{ borderColor: 'rgba(108,92,231,0.3)', borderTopColor: '#6C5CE7' }}
                />
              </div>
            ) : (studentStatsQuery.data ?? []).length > 0 ? (
              <>
                {/* Stats header */}
                <div className="mb-1 grid grid-cols-3 gap-1 px-1 text-center">
                  <span className="text-tg-hint text-xs">{t('teacher.col_student')}</span>
                  <span className="text-tg-hint text-xs">{t('teacher.col_attend')}</span>
                  <span className="text-tg-hint text-xs">{t('teacher.col_hw')}</span>
                </div>
                {(studentStatsQuery.data ?? []).map((s) => {
                  const pct = s.attendance.pct;
                  const attColor =
                    pct == null
                      ? 'var(--surface-2)'
                      : pct >= 80
                        ? '#10B981'
                        : pct >= 60
                          ? '#F59E0B'
                          : '#EF4444';
                  return (
                    <button
                      key={s.student.id}
                      onClick={() => {
                        WebApp.HapticFeedback.selectionChanged();
                        navigate(`/teacher/class/${classId}/student/${s.student.id}`);
                      }}
                      className="glass-option press grid w-full grid-cols-3 items-center gap-2 rounded-2xl p-3 text-left"
                    >
                      {/* Name */}
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                          style={{ background: '#6C5CE7' }}
                        >
                          {s.student.first_name[0]}
                          {s.student.last_name?.[0] ?? ''}
                        </div>
                        <span className="truncate text-xs font-medium">{s.student.first_name}</span>
                      </div>
                      {/* Attendance */}
                      <div className="text-center">
                        <span className="text-sm font-bold" style={{ color: attColor }}>
                          {pct != null ? `${pct}%` : '—'}
                        </span>
                        <p className="text-tg-hint text-xs">
                          {s.attendance.present}/{s.attendance.total}
                        </p>
                      </div>
                      {/* Homework */}
                      <div className="text-center">
                        <span
                          className="text-sm font-bold"
                          style={{
                            color:
                              s.homework.total === 0
                                ? 'var(--surface-2)'
                                : s.homework.submitted === s.homework.total
                                  ? '#10B981'
                                  : '#F59E0B',
                          }}
                        >
                          {s.homework.submitted}/{s.homework.total}
                        </span>
                        <p className="text-tg-hint text-xs">{t('teacher.submitted_count')}</p>
                      </div>
                    </button>
                  );
                })}
              </>
            ) : (
              <>
                {(studentsQuery.data ?? []).map((student) => (
                  <button
                    key={student.id}
                    onClick={() => {
                      WebApp.HapticFeedback.selectionChanged();
                      navigate(`/teacher/class/${classId}/student/${student.id}`);
                    }}
                    className="glass-option press flex w-full items-center gap-3 rounded-2xl p-3 text-left"
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ background: '#6C5CE7' }}
                    >
                      {student.first_name[0]}
                      {student.last_name?.[0] ?? ''}
                    </div>
                    <span className="flex-1 text-sm font-medium">
                      {student.first_name} {student.last_name ?? ''}
                    </span>
                    <span style={{ color: 'var(--faint)', fontSize: 18 }}>›</span>
                  </button>
                ))}
                {(studentsQuery.data ?? []).length === 0 && (
                  <p className="text-tg-hint pt-4 text-center text-sm">
                    {t('teacher.no_students')}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── HOMEWORK ── */}
        {tab === 'homework' && (
          <div>
            <button
              onClick={() => setShowAddHw(true)}
              className="glass-btn press mb-4 w-full rounded-xl py-3 text-sm font-semibold"
              style={{ background: '#8B5CF6' }}
            >
              {t('teacher.create_hw_btn')}
            </button>

            {hwQuery.isLoading ? (
              <div className="flex justify-center pt-8">
                <div
                  className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent"
                  style={{ borderColor: 'rgba(108,92,231,0.3)', borderTopColor: '#6C5CE7' }}
                />
              </div>
            ) : (
              <div className="stagger space-y-3">
                {(hwQuery.data ?? []).map((hw) => (
                  <button
                    key={hw.id}
                    onClick={() => navigate(`/teacher/homework/${hw.id}/submissions`)}
                    className="glass-card press w-full rounded-2xl p-4 text-left"
                  >
                    <p className="font-medium">{hw.title}</p>
                    {hw.due_date && (
                      <p className="text-tg-hint mt-0.5 text-xs">
                        {t('teacher.deadline_label')}{' '}
                        {new Date(hw.due_date).toLocaleDateString(i18n.language, {
                          day: 'numeric',
                          month: 'long',
                        })}
                      </p>
                    )}
                    {hw.description && (
                      <p className="text-tg-hint mt-1 line-clamp-2 text-xs">{hw.description}</p>
                    )}
                  </button>
                ))}
                {(hwQuery.data ?? []).length === 0 && (
                  <p className="text-tg-hint pt-4 text-center text-sm">{t('teacher.no_hw')}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Generate Lessons Modal ── */}
      {showGenerate && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div className="glass-card w-full rounded-t-3xl p-6">
            <h3 className="mb-1 text-center text-lg font-semibold">{t('teacher.autogen_title')}</h3>
            <p className="text-tg-hint mb-5 text-center text-xs">{t('teacher.autogen_desc')}</p>

            {/* Weeks selector */}
            <p className="text-tg-hint mb-2 text-xs font-semibold uppercase tracking-wide">
              {t('teacher.weeks_label')}
            </p>
            <div className="mb-5 grid grid-cols-4 gap-2">
              {[2, 4, 8, 12].map((w) => (
                <button
                  key={w}
                  onClick={() => setGenerateWeeks(w)}
                  className="press rounded-xl py-3 text-sm font-bold transition-colors"
                  style={{
                    background: generateWeeks === w ? '#3B82F6' : 'var(--surface-2)',
                    color: generateWeeks === w ? '#fff' : 'var(--surface-2)',
                    border:
                      generateWeeks === w ? '1.5px solid #3B82F6' : '1.5px solid var(--hairline)',
                  }}
                >
                  {t('teacher.weeks_short', { n: w })}
                </button>
              ))}
            </div>

            <div
              className="mb-5 rounded-xl p-3 text-xs"
              style={{
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)',
              }}
            >
              <span style={{ color: '#3B82F6' }}>
                {t('teacher.autogen_info')}{' '}
                <b>
                  {t('teacher.autogen_slots', {
                    n: generateWeeks * (lessonsQuery.data?.length ?? 3),
                  })}
                </b>
              </span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowGenerate(false);
                  setGenerateResult(null);
                }}
                className="glass-option press flex-1 rounded-xl py-3 text-sm"
              >
                {t('homework.cancel')}
              </button>
              <button
                onClick={async () => {
                  setShowGenerate(false);
                  await handleGenerate();
                }}
                disabled={generateLessons.isPending}
                className="press flex-1 rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
                style={{ background: '#3B82F6', color: '#fff' }}
              >
                {generateLessons.isPending
                  ? t('teacher.saving')
                  : t('teacher.generate_btn', { n: generateWeeks })}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Lesson Modal ── */}
      {showAddLesson && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div className="glass-card w-full rounded-t-3xl p-6">
            <h3 className="mb-4 text-center text-lg font-semibold">{t('teacher.add_lesson')}</h3>
            <input
              type="text"
              placeholder={t('teacher.lesson_title_ph')}
              value={lessonTitle}
              onChange={(e) => setLessonTitle(e.target.value)}
              className={`mb-3 ${inputCls}`}
              style={inputStyle}
            />
            <input
              type="date"
              value={lessonDate}
              onChange={(e) => setLessonDate(e.target.value)}
              className={`mb-3 ${inputCls}`}
              style={inputStyle}
            />
            <input
              type="time"
              value={lessonTime}
              onChange={(e) => setLessonTime(e.target.value)}
              className={`mb-4 ${inputCls}`}
              style={inputStyle}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddLesson(false)}
                className="glass-option press flex-1 rounded-xl py-3 text-sm"
              >
                {t('homework.cancel')}
              </button>
              <button
                onClick={() => void handleAddLesson()}
                disabled={!lessonDate || !lessonTime || createLesson.isPending}
                className="glass-btn press flex-1 rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
              >
                {createLesson.isPending ? t('teacher.saving') : t('teacher.generate_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Homework Modal ── */}
      {showAddHw && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div className="glass-card w-full rounded-t-3xl p-6">
            <h3 className="mb-4 text-center text-lg font-semibold">{t('teacher.add_hw')}</h3>
            <input
              type="text"
              placeholder={t('teacher.hw_title_ph')}
              value={hwTitle}
              onChange={(e) => setHwTitle(e.target.value)}
              className={`mb-3 ${inputCls}`}
              style={inputStyle}
            />
            <textarea
              placeholder={t('teacher.hw_desc_ph')}
              value={hwDesc}
              onChange={(e) => setHwDesc(e.target.value)}
              rows={3}
              className={`mb-3 resize-none ${inputCls}`}
              style={inputStyle}
            />
            <input
              type="date"
              value={hwDue}
              onChange={(e) => setHwDue(e.target.value)}
              className={`mb-4 ${inputCls}`}
              style={inputStyle}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddHw(false)}
                className="glass-option press flex-1 rounded-xl py-3 text-sm"
              >
                {t('homework.cancel')}
              </button>
              <button
                onClick={() => void handleAddHw()}
                disabled={!hwTitle || createHw.isPending}
                className="glass-btn press flex-1 rounded-xl py-3 text-sm font-semibold disabled:opacity-50"
                style={{ background: '#8B5CF6' }}
              >
                {createHw.isPending ? t('teacher.saving') : t('teacher.generate_btn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
