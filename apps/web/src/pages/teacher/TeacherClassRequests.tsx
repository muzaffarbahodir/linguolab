/**
 * TeacherClassRequests — учитель создаёт заявки на открытие курсов + видит статус.
 * Route: /teacher/class-requests
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import { useMyClassRequests, useCreateClassRequest } from '../../api/class-requests';
import { useLanguages } from '../../api/languages';
import { toast } from '../../store/toast';
import { LEVEL_COLOR } from '../../lib/status';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  APPROVED: '#10B981',
  REJECTED: '#EF4444',
};

const inputCls =
  'bg-surface-2 border-hairline w-full rounded-xl border px-3 py-2.5 text-sm text-white outline-none';

// ── Create Form ───────────────────────────────────────────────────────────────

function NewRequestForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateClassRequest();
  const { data: languages } = useLanguages();

  const [langId, setLangId] = useState('');
  const [title, setTitle] = useState('');
  const [level, setLevel] = useState('A1');
  const [description, setDescription] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [courseDuration, setCourseDuration] = useState('');
  const [courseIncludes, setCourseIncludes] = useState('');
  const [courseRequirements, setCourseRequirements] = useState('');
  const [note, setNote] = useState('');

  const toLines = (s: string) =>
    s
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
  const [days, setDays] = useState<string[]>([]);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [maxStudents, setMaxStudents] = useState('10');

  function toggleDay(key: string) {
    setDays((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
  }

  function handleSubmit() {
    if (!langId || !title.trim()) {
      toast.error(t('class_req.err_required'));
      return;
    }

    create.mutate(
      {
        language_id: langId,
        title: title.trim(),
        level,
        description: description.trim() || undefined,
        meeting_url: meetingUrl.trim() || undefined,
        course_duration: courseDuration.trim() || undefined,
        course_includes: toLines(courseIncludes),
        course_requirements: toLines(courseRequirements),
        note: note.trim() || undefined,
        schedule_days: days.length ? days : undefined,
        schedule_time: time || undefined,
        schedule_duration: parseInt(duration, 10) || undefined,
        max_students: parseInt(maxStudents, 10) || undefined,
      },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          onClose();
        },
        onError: () => toast.error(t('class_req.err_submit')),
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end overflow-y-auto bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-5 pb-10 pt-5"
        style={{ background: '#1a2538' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <h2 className="mb-4 font-bold">{t('class_req.form_title')}</h2>

        {/* Язык */}
        <p className="text-muted mb-1 text-xs">{t('class_req.lang_label')}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {languages?.map((l) => (
            <button
              key={l.id}
              onClick={() => setLangId(l.id)}
              className={`press rounded-xl px-3 py-1.5 text-sm font-medium ${
                langId === l.id ? 'text-white' : 'bg-surface-2 text-white/60'
              }`}
              style={langId === l.id ? { background: l.color ?? '#C8623F' } : undefined}
            >
              {l.flag_emoji} {l.name_ru}
            </button>
          ))}
        </div>

        {/* Название */}
        <p className="text-muted mb-1 text-xs">{t('class_req.title_label')}</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('class_req.title_ph')}
          className={`${inputCls} mb-3`}
        />

        {/* Уровень */}
        <p className="text-muted mb-1 text-xs">{t('class_req.level_label')}</p>
        <div className="mb-3 flex gap-1.5">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={`press flex-1 rounded-xl py-2 text-xs font-bold ${
                level === l ? 'text-white' : 'bg-surface-2 text-muted'
              }`}
              style={level === l ? { background: LEVEL_COLOR[l] ?? '#C8623F' } : undefined}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Описание */}
        <p className="text-muted mb-1 text-xs">{t('class_req.desc_label')}</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('class_req.desc_ph')}
          rows={2}
          className={`${inputCls} mb-3 resize-none`}
        />

        {/* Расписание */}
        <p className="text-muted mb-1 text-xs">{t('class_req.days_label')}</p>
        <div className="mb-3 flex gap-1">
          {DAY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => toggleDay(key)}
              className={`press flex-1 rounded-xl py-1.5 text-xs font-bold ${
                days.includes(key) ? 'bg-brand text-white' : 'bg-surface-2 text-muted'
              }`}
            >
              {t(`schedule.day_${key.toLowerCase()}`)}
            </button>
          ))}
        </div>

        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <p className="text-muted mb-1 text-xs">{t('class_req.time_label')}</p>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <p className="text-muted mb-1 text-xs">{t('class_req.duration_label')}</p>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <p className="text-muted mb-1 text-xs">{t('class_req.seats_label')}</p>
            <input
              type="number"
              value={maxStudents}
              onChange={(e) => setMaxStudents(e.target.value)}
              placeholder="10"
              className={inputCls}
            />
          </div>
        </div>

        {/* Ссылка на онлайн-урок (Zoom/Meet) */}
        <p className="text-muted mb-1 text-xs">{t('class_req.meeting_label')}</p>
        <input
          value={meetingUrl}
          onChange={(e) => setMeetingUrl(e.target.value)}
          placeholder="https://zoom.us/j/..."
          className={`${inputCls} mb-3`}
        />

        {/* Инфо о курсе (направлении) */}
        <p className="text-muted mb-1 text-xs">{t('class_req.duration_course_label')}</p>
        <input
          value={courseDuration}
          onChange={(e) => setCourseDuration(e.target.value)}
          placeholder={t('class_req.duration_course_ph')}
          className={`${inputCls} mb-3`}
        />

        <p className="text-muted mb-1 text-xs">{t('class_req.includes_label')}</p>
        <textarea
          value={courseIncludes}
          onChange={(e) => setCourseIncludes(e.target.value)}
          placeholder={t('class_req.includes_ph')}
          rows={3}
          className={`${inputCls} mb-3 resize-none`}
        />

        <p className="text-muted mb-1 text-xs">{t('class_req.requirements_label')}</p>
        <textarea
          value={courseRequirements}
          onChange={(e) => setCourseRequirements(e.target.value)}
          placeholder={t('class_req.requirements_ph')}
          rows={3}
          className={`${inputCls} mb-3 resize-none`}
        />

        {/* Комментарий */}
        <p className="text-muted mb-1 text-xs">{t('class_req.note_label')}</p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('class_req.note_ph')}
          rows={2}
          className={`${inputCls} mb-4 resize-none`}
        />

        <button
          onClick={handleSubmit}
          disabled={create.isPending || !langId || !title.trim()}
          className="press w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#C8623F,#ECA985)' }}
        >
          {create.isPending ? '...' : t('class_req.submit')}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function TeacherClassRequestsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const { data: requests, isLoading } = useMyClassRequests();

  useBackButton(() => navigate('/teacher'));

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass border-surface-2 border-b px-4 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">📋 {t('class_req.my_requests')}</h1>
          <button
            onClick={() => setShowForm(true)}
            className="press rounded-xl px-3 py-1.5 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#C8623F,#ECA985)' }}
          >
            + {t('class_req.new_btn')}
          </button>
        </div>
        <p className="text-muted mt-1 text-xs">{t('class_req.subtitle')}</p>
      </div>

      <div className="stagger flex flex-col gap-3 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {!isLoading && requests?.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <span className="text-5xl">📋</span>
            <p className="font-bold">{t('class_req.empty_title')}</p>
            <p className="text-muted text-sm">{t('class_req.empty_sub')}</p>
            <button
              onClick={() => setShowForm(true)}
              className="press rounded-xl px-6 py-2.5 font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#C8623F,#ECA985)' }}
            >
              {t('class_req.create_btn')}
            </button>
          </div>
        )}

        {requests?.map((req) => {
          const statusColor = STATUS_COLOR[req.status] ?? '#fff';
          const statusLabel = t(`class_req.status_${req.status}`);

          return (
            <div key={req.id} className="bg-surface border-hairline rounded-2xl border p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span>{req.language.flag_emoji}</span>
                    <span className="font-semibold">{req.title}</span>
                    <span
                      className="rounded-full px-1.5 py-0.5 text-xs font-bold"
                      style={{
                        background: `${LEVEL_COLOR[req.level] ?? '#C8623F'}22`,
                        color: LEVEL_COLOR[req.level] ?? '#ECA985',
                      }}
                    >
                      {req.level}
                    </span>
                  </div>
                  <p className="text-muted mt-0.5 text-xs">
                    {new Date(req.created_at).toLocaleDateString(i18n.language)}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: `${statusColor}22`,
                    color: statusColor,
                    border: `1px solid ${statusColor}44`,
                  }}
                >
                  {statusLabel}
                </span>
              </div>

              {req.description && <p className="text-muted mb-1 text-xs">{req.description}</p>}

              {req.admin_note && (
                <p
                  className={`mt-2 rounded-xl p-2 text-xs ${
                    req.status === 'REJECTED' ? 'bg-danger/10' : 'bg-ok/10'
                  }`}
                  style={{ color: req.status === 'REJECTED' ? '#FCA5A5' : '#6EE7B7' }}
                >
                  💬 {req.admin_note}
                </p>
              )}

              {req.approved_class && (
                <p className="text-ok mt-2 text-xs">
                  ✅ {t('class_req.class_created', { title: req.approved_class.title })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {showForm && <NewRequestForm onClose={() => setShowForm(false)} />}
    </div>
  );
}
