/**
 * AdminClasses — список классов, создание, редактирование, управление семестром.
 * Route: /admin/classes
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useAdminClasses,
  useCreateClass,
  useUpdateClass,
  useUpdateClassStatus,
  useDeleteClass,
  useAdminTeachers,
  type AdminClass,
  type ClassStatus,
} from '../../api/admin';
import { useLanguages } from '../../api/languages';
import { useSetClassSchedule } from '../../api/classes';
import { useAuthStore } from '../../store/auth';
import { formatUzs } from '../../lib/money';

const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

const STATUS_LABEL: Record<ClassStatus, string> = {
  DRAFT: 'Черновик',
  ENROLLMENT_OPEN: 'Запись открыта',
  ACTIVE: 'Активен',
  EXAM: 'Экзамен',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

const STATUS_COLOR: Record<ClassStatus, string> = {
  DRAFT: 'var(--surface-2)',
  ENROLLMENT_OPEN: '#3B82F6',
  ACTIVE: '#10B981',
  EXAM: '#F59E0B',
  COMPLETED: '#8B5CF6',
  CANCELLED: '#EF4444',
};

function ScheduleForm({ cls, onClose }: { cls: AdminClass; onClose: () => void }) {
  const { t } = useTranslation();
  const setSchedule = useSetClassSchedule();
  const [days, setDays] = useState<string[]>([] as string[]);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('60');

  function toggleDay(key: string) {
    setDays((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));
  }

  function handleSave() {
    if (!days.length || !time || !duration) return;
    setSchedule.mutate(
      {
        classId: cls.id,
        schedule_days: days,
        schedule_time: time,
        schedule_duration: parseInt(duration, 10),
      },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          onClose();
        },
        onError: () => WebApp.showAlert(t('admin.classes.schedule_error')),
      },
    );
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--hairline)',
    color: '#fff',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-5 pb-10 pt-5"
        style={{ background: '#1a2538' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <h2 className="mb-1 font-bold">{t('admin.classes.schedule_title')}</h2>
        <p className="text-muted mb-4 text-xs">{cls.title}</p>

        <p className="text-muted mb-2 text-xs font-semibold">{t('admin.classes.days_label')}</p>
        <div className="mb-4 flex gap-1.5">
          {DAY_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => toggleDay(key)}
              className="press flex-1 rounded-xl py-2 text-xs font-bold"
              style={{
                background: days.includes(key) ? '#6C5CE7' : 'var(--surface-2)',
                color: days.includes(key) ? '#fff' : 'var(--surface-2)',
              }}
            >
              {t(`schedule.day_${key.toLowerCase()}`)}
            </button>
          ))}
        </div>

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <p className="text-muted mb-1 text-xs font-semibold">{t('admin.classes.time_label')}</p>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="flex-1">
            <p className="text-muted mb-1 text-xs font-semibold">
              {t('admin.classes.duration_label')}
            </p>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="60"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={setSchedule.isPending || !days.length}
          className="press w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)' }}
        >
          {setSchedule.isPending ? '...' : t('admin.classes.schedule_save')}
        </button>
      </div>
    </div>
  );
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_COLOR: Record<string, string> = {
  A1: '#10B981',
  A2: '#3B82F6',
  B1: '#F59E0B',
  B2: '#EF4444',
  C1: '#8B5CF6',
  C2: '#EC4899',
};

// ── ClassForm ─────────────────────────────────────────────────────────────────

function ClassForm({ initial, onClose }: { initial?: AdminClass; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateClass();
  const update = useUpdateClass();
  const { data: languages } = useLanguages();
  const { data: teachers } = useAdminTeachers(1);

  const [langId, setLangId] = useState(initial?.language.id ?? '');
  const [teacherId, setTeacherId] = useState(initial?.teacher.id ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [level, setLevel] = useState(initial?.level ?? 'A1');
  const [priceUzs, setPriceUzs] = useState(initial ? String(initial.price_uzs) : '');
  const [priceUsd, setPriceUsd] = useState(initial ? String(initial.price_usd) : '');
  const [maxStudents, setMaxStudents] = useState(initial ? String(initial.max_students) : '10');
  const [description, setDescription] = useState(initial?.description ?? '');

  const isEdit = !!initial;
  const isPending = create.isPending || update.isPending;

  function handleSave() {
    if (!title.trim() || !level || !priceUzs) return;
    const priceUzsNum = parseInt(priceUzs, 10);
    const priceUsdNum = parseInt(priceUsd, 10) || 0;
    if (isNaN(priceUzsNum) || priceUzsNum <= 0) return;

    if (isEdit) {
      update.mutate(
        {
          id: initial.id,
          title: title.trim(),
          level,
          price_uzs: priceUzsNum,
          price_usd: priceUsdNum,
          max_students: parseInt(maxStudents, 10) || 10,
          description: description.trim() || undefined,
        },
        {
          onSuccess: () => {
            WebApp.HapticFeedback.notificationOccurred('success');
            onClose();
          },
          onError: () => WebApp.showAlert(t('admin.classes.save_error')),
        },
      );
    } else {
      if (!langId || !teacherId) return;
      create.mutate(
        {
          language_id: langId,
          teacher_id: teacherId,
          title: title.trim(),
          level,
          price_uzs: priceUzsNum,
          price_usd: priceUsdNum,
          max_students: parseInt(maxStudents, 10) || 10,
          description: description.trim() || undefined,
        },
        {
          onSuccess: () => {
            WebApp.HapticFeedback.notificationOccurred('success');
            onClose();
          },
          onError: () => WebApp.showAlert(t('admin.classes.create_error')),
        },
      );
    }
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--hairline)',
    color: '#fff',
  };
  const selectStyle = { ...inputStyle, appearance: 'none' as const };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl px-5 pb-10 pt-5"
        style={{ background: '#1a2538' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <h2 className="mb-4 font-bold">
          {isEdit ? t('admin.classes.edit_title') : t('admin.classes.create_title')}
        </h2>

        {!isEdit && (
          <>
            <p className="text-muted mb-1 text-xs">{t('admin.classes.lang_label')}</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {languages?.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLangId(l.id)}
                  className="press rounded-xl px-3 py-1.5 text-sm font-medium"
                  style={{
                    background: langId === l.id ? (l.color ?? '#6C5CE7') : 'var(--surface-2)',
                    color: langId === l.id ? '#fff' : 'var(--surface-2)',
                  }}
                >
                  {l.flag_emoji} {l.name_ru}
                </button>
              ))}
            </div>

            <p className="text-muted mb-1 text-xs">{t('admin.classes.teacher_label')}</p>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="mb-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={selectStyle}
            >
              <option value="">{t('admin.classes.teacher_ph')}</option>
              {teachers?.items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.user.first_name} {t.user.last_name ?? ''}
                </option>
              ))}
            </select>
          </>
        )}

        <p className="text-muted mb-1 text-xs">{t('admin.classes.name_label')}</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder=""
          className="mb-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />

        <p className="text-muted mb-1 text-xs">{t('admin.classes.level_label')}</p>
        <div className="mb-3 flex gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className="press flex-1 rounded-xl py-2 text-xs font-bold"
              style={{
                background: level === l ? (LEVEL_COLOR[l] ?? '#6C5CE7') : 'var(--surface-2)',
                color: level === l ? '#fff' : 'var(--surface-2)',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Цены UZS + USD */}
        <div className="mb-3 flex gap-2">
          <div className="flex-1">
            <p className="text-muted mb-1 text-xs">Цена (сум)</p>
            <input
              value={priceUzs}
              onChange={(e) => setPriceUzs(e.target.value)}
              placeholder="500000"
              type="number"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="flex-1">
            <p className="text-muted mb-1 text-xs">Цена (USD)</p>
            <input
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              placeholder="40"
              type="number"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        <div className="mb-3">
          <p className="text-muted mb-1 text-xs">{t('admin.classes.max_label')}</p>
          <input
            value={maxStudents}
            onChange={(e) => setMaxStudents(e.target.value)}
            placeholder="10"
            type="number"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
        </div>

        <p className="text-muted mb-1 text-xs">{t('admin.classes.desc_label')}</p>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('admin.classes.desc_ph')}
          rows={2}
          className="mb-4 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />

        <button
          onClick={handleSave}
          disabled={isPending || !title.trim() || !priceUzs || (!isEdit && (!langId || !teacherId))}
          className="press w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)' }}
        >
          {isPending ? '...' : isEdit ? t('admin.classes.save') : t('admin.classes.create_btn')}
        </button>
      </div>
    </div>
  );
}

// ── ClassCard ─────────────────────────────────────────────────────────────────

const NEXT_STATUS: Partial<
  Record<ClassStatus, { status: ClassStatus; label: string; color: string }>
> = {
  DRAFT: { status: 'ENROLLMENT_OPEN', label: 'Открыть запись', color: '#3B82F6' },
  ENROLLMENT_OPEN: { status: 'ACTIVE', label: 'Начать семестр', color: '#10B981' },
  ACTIVE: { status: 'EXAM', label: 'Экзамен', color: '#F59E0B' },
  EXAM: { status: 'COMPLETED', label: 'Завершить', color: '#8B5CF6' },
};

function ClassCard({ cls, canDelete }: { cls: AdminClass; canDelete: boolean }) {
  const { t } = useTranslation();
  const updateClass = useUpdateClass();
  const updateStatus = useUpdateClassStatus();
  const deleteClass = useDeleteClass();
  const [showEdit, setShowEdit] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const color = cls.language.color ?? '#6C5CE7';
  const levelColor = LEVEL_COLOR[cls.level] ?? '#6C5CE7';
  const statusLabel = STATUS_LABEL[cls.status] ?? cls.status;
  const statusColor = STATUS_COLOR[cls.status] ?? 'var(--surface-2)';
  const nextStep = NEXT_STATUS[cls.status];

  function handleNextStatus() {
    if (!nextStep) return;
    WebApp.showConfirm(
      `Перевести класс "${cls.title}" → ${STATUS_LABEL[nextStep.status]}?`,
      (ok) => {
        if (!ok) return;
        updateStatus.mutate(
          { id: cls.id, status: nextStep.status },
          { onSuccess: () => WebApp.HapticFeedback.notificationOccurred('success') },
        );
      },
    );
  }

  function handleCancel() {
    if (cls.status === 'COMPLETED' || cls.status === 'CANCELLED') return;
    WebApp.showConfirm(`Отменить класс "${cls.title}"?`, (ok) => {
      if (!ok) return;
      updateStatus.mutate({ id: cls.id, status: 'CANCELLED' });
    });
  }

  function toggleActive() {
    updateClass.mutate(
      { id: cls.id, is_active: !cls.is_active },
      { onSuccess: () => WebApp.HapticFeedback.selectionChanged() },
    );
  }

  function handleDelete() {
    WebApp.showConfirm(t('admin.classes.delete_confirm', { title: cls.title }), (ok) => {
      if (!ok) return;
      deleteClass.mutate(cls.id, {
        onSuccess: () => WebApp.HapticFeedback.notificationOccurred('success'),
        onError: () => WebApp.showAlert(t('admin.classes.delete_error')),
      });
    });
  }

  const enrolled = cls._count?.enrollments ?? cls.enrolled_count;

  return (
    <>
      <div
        className={`overflow-hidden rounded-2xl border ${
          cls.is_active ? 'bg-surface border-hairline' : 'border-white/[0.04] bg-white/[0.02]'
        } ${cls.status === 'CANCELLED' ? 'opacity-50' : ''}`}
      >
        <div className="h-1 w-full" style={{ background: color }} />
        <div className="p-4">
          {/* Header row */}
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{cls.language.flag_emoji}</span>
              <span className="text-muted text-xs">{cls.language.name_ru}</span>
              <span
                className="rounded-full px-1.5 py-0.5 text-xs font-bold text-white"
                style={{ background: levelColor }}
              >
                {cls.level}
              </span>
            </div>
            {/* Status badge */}
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{
                background: `${statusColor}22`,
                color: statusColor,
                border: `1px solid ${statusColor}44`,
              }}
            >
              {statusLabel}
            </span>
          </div>

          <p className="mb-0.5 font-semibold leading-tight">{cls.title}</p>
          {cls.semester_label && (
            <p className="text-brand-400 mb-0.5 text-xs">📅 {cls.semester_label}</p>
          )}
          <p className="text-muted mb-2 text-xs">
            👤 {cls.teacher.user.first_name} {cls.teacher.user.last_name ?? ''}
          </p>

          {/* Prices + count */}
          <div className="mb-3 flex items-center justify-between">
            <div className="text-muted text-xs">
              <span className="font-bold text-white">{formatUzs(cls.price_uzs)}</span>
              {cls.price_usd > 0 && <span className="text-faint"> / ${cls.price_usd}</span>}
              {' · '}
              <span style={{ color: enrolled >= cls.max_students ? '#EF4444' : '#10B981' }}>
                {t('admin.classes.students_count', { n: enrolled, max: cls.max_students })}
              </span>
            </div>
          </div>

          {/* Lifecycle transition button */}
          {nextStep && cls.status !== 'CANCELLED' && (
            <button
              onClick={handleNextStatus}
              disabled={updateStatus.isPending}
              className="press mb-2 w-full rounded-xl py-2 text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: nextStep.color }}
            >
              {nextStep.label} →
            </button>
          )}

          {/* Action buttons row */}
          <div className="flex gap-1">
            <button
              onClick={toggleActive}
              disabled={updateClass.isPending}
              className={`press flex-1 rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-40 ${
                cls.is_active ? 'bg-danger/10 text-danger' : 'bg-ok/15 text-ok'
              }`}
            >
              {cls.is_active ? t('admin.classes.archive') : t('admin.classes.restore')}
            </button>
            <button
              onClick={() => setShowSchedule(true)}
              className="bg-info/15 text-info press rounded-lg px-2 py-1.5 text-xs font-medium"
            >
              📅
            </button>
            <button
              onClick={() => setShowEdit(true)}
              className="bg-brand/15 text-brand-400 press rounded-lg px-2 py-1.5 text-xs font-medium"
            >
              ✏️
            </button>
            {cls.status !== 'COMPLETED' && cls.status !== 'CANCELLED' && (
              <button
                onClick={handleCancel}
                disabled={updateStatus.isPending}
                className="bg-danger/10 text-danger press rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-40"
              >
                ✕
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleteClass.isPending}
                className="bg-danger/10 text-danger press rounded-lg px-2 py-1.5 text-xs font-medium disabled:opacity-40"
              >
                🗑
              </button>
            )}
          </div>
        </div>
      </div>
      {showEdit && <ClassForm initial={cls} onClose={() => setShowEdit(false)} />}
      {showSchedule && <ScheduleForm cls={cls} onClose={() => setShowSchedule(false)} />}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminClassesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canDelete = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useAdminClasses(page);

  useBackButton(() => navigate('/admin'));

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass border-surface-2 border-b px-4 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">📚 {t('admin.classes.title')}</h1>
            {data && (
              <p className="text-muted text-xs">{t('admin.classes.total', { n: data.total })}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/admin/class-requests')}
              className="bg-info/20 text-info press rounded-xl px-3 py-1.5 text-sm font-semibold"
            >
              {t('admin_cr.title')}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="press rounded-xl px-3 py-1.5 text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg,#6C5CE7,#A78BFA)' }}
            >
              {t('admin.classes.create')}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-4xl">📚</span>
            <p className="font-bold">{t('admin.classes.no_classes')}</p>
          </div>
        )}

        {data?.items.map((cls) => (
          <ClassCard key={cls.id} cls={cls} canDelete={canDelete} />
        ))}

        {data && data.pages > 1 && (
          <div className="flex justify-center gap-3 pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="bg-surface-2 press rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-30"
            >
              {t('admin.students.prev')}
            </button>
            <span className="text-muted self-center text-sm">
              {page} / {data.pages}
            </span>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              className="bg-surface-2 press rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-30"
            >
              {t('admin.students.next')}
            </button>
          </div>
        )}
      </div>

      {showCreate && <ClassForm onClose={() => setShowCreate(false)} />}
    </div>
  );
}
