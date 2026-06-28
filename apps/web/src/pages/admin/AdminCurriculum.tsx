/**
 * AdminCurriculum — редактор программы курса (SUPER_ADMIN).
 * Список уроков направления: добавить/изменить/удалить, материалы, превью.
 * Route: /admin/languages/:id/lessons
 */
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Plus, Lock, PlayCircle, GripVertical } from 'lucide-react';

import { useBackButton } from '../../hooks/useBackButton';
import {
  useAdminLessons,
  useUpsertLesson,
  useDeleteLesson,
  type AdminCourseLesson,
  type LessonMaterial,
} from '../../api/languages';

type Draft = {
  id?: string;
  title: string;
  description: string;
  duration_min: string;
  is_preview: boolean;
  video_url: string;
  materials: string; // "Название | https://url" по строке
  is_active: boolean;
};

const EMPTY: Draft = {
  title: '',
  description: '',
  duration_min: '',
  is_preview: false,
  video_url: '',
  materials: '',
  is_active: true,
};

function matsToText(mats: LessonMaterial[]): string {
  return mats.map((m) => `${m.title} | ${m.url}`).join('\n');
}

function textToMats(s: string): LessonMaterial[] {
  return s
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf('|');
      if (idx === -1) return { title: line, url: line };
      return { title: line.slice(0, idx).trim(), url: line.slice(idx + 1).trim() };
    })
    .filter((m) => m.url);
}

function toDraft(l: AdminCourseLesson): Draft {
  return {
    id: l.id,
    title: l.title,
    description: l.description ?? '',
    duration_min: l.duration_min != null ? String(l.duration_min) : '',
    is_preview: l.is_preview,
    video_url: l.video_url ?? '',
    materials: matsToText(l.materials ?? []),
    is_active: l.is_active,
  };
}

export function AdminCurriculumPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: lessons, isLoading } = useAdminLessons(id);
  const upsert = useUpsertLesson(id ?? '');
  const del = useDeleteLesson(id ?? '');

  const [draft, setDraft] = useState<Draft | null>(null);

  useBackButton(() => {
    if (draft) setDraft(null);
    else navigate('/admin/languages');
  });

  const handleSave = () => {
    if (!draft || !id) return;
    if (!draft.title.trim()) {
      WebApp.showAlert(t('admin.curriculum.title_required'));
      return;
    }
    const dur = parseInt(draft.duration_min, 10);
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      duration_min: Number.isFinite(dur) && dur > 0 ? dur : null,
      is_preview: draft.is_preview,
      video_url: draft.video_url.trim() || null,
      materials: textToMats(draft.materials),
      is_active: draft.is_active,
    };
    upsert.mutate(draft.id ? { id: draft.id, ...payload } : payload, {
      onSuccess: () => setDraft(null),
    });
  };

  const handleDelete = () => {
    if (!draft?.id) return;
    WebApp.showConfirm(t('admin.curriculum.delete_confirm'), (ok) => {
      if (!ok || !draft.id) return;
      del.mutate(draft.id, { onSuccess: () => setDraft(null) });
    });
  };

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('admin.curriculum.title')}</h1>
          <p className="text-tg-hint text-sm">{t('admin.curriculum.desc')}</p>
        </div>
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="glass-btn press flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold"
        >
          <Plus size={15} /> {t('admin.curriculum.add')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
        </div>
      ) : !lessons?.length ? (
        <div className="py-12 text-center">
          <p className="mb-2 text-4xl">📚</p>
          <p className="text-tg-hint text-sm">{t('admin.curriculum.empty')}</p>
        </div>
      ) : (
        <div className="stagger flex flex-col gap-2">
          {lessons.map((l, i) => (
            <button
              key={l.id}
              onClick={() => setDraft(toDraft(l))}
              className={`glass-card press flex items-center gap-3 rounded-2xl p-3 text-left ${
                l.is_active ? '' : 'opacity-50'
              }`}
            >
              <GripVertical size={16} className="text-faint shrink-0" />
              <span className="text-faint w-4 text-center text-xs font-bold tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{l.title}</p>
                <p className="text-tg-hint flex items-center gap-2 text-xs">
                  {l.duration_min ? <span>{t('course.min_n', { n: l.duration_min })}</span> : null}
                  {l.materials?.length > 0 && (
                    <span>· {t('course.materials_n', { n: l.materials.length })}</span>
                  )}
                </p>
              </div>
              {l.is_preview ? (
                <PlayCircle size={16} className="text-ok shrink-0" />
              ) : (
                <Lock size={14} className="text-faint shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Editor sheet */}
      {draft && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDraft(null);
          }}
        >
          <div
            className="max-h-[90vh] overflow-y-auto rounded-t-3xl p-6"
            style={{
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              background: 'var(--secondary-bg)',
            }}
          >
            <div className="bg-[color:var(--text)]/15 mx-auto mb-4 h-1 w-10 rounded-full" />
            <h3 className="mb-4 text-base font-bold">
              {draft.id ? t('admin.curriculum.edit') : t('admin.curriculum.add')}
            </h3>

            <div className="flex flex-col gap-3">
              <Field label={t('admin.curriculum.f_title')}>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="input"
                  placeholder={t('admin.curriculum.f_title_ph')}
                />
              </Field>

              <Field label={t('admin.curriculum.f_desc')}>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  className="input resize-none"
                />
              </Field>

              <Field label={t('admin.curriculum.f_duration')}>
                <input
                  value={draft.duration_min}
                  onChange={(e) => setDraft({ ...draft, duration_min: e.target.value })}
                  className="input"
                  inputMode="numeric"
                  placeholder="45"
                />
              </Field>

              <Field label={t('admin.curriculum.f_video')}>
                <input
                  value={draft.video_url}
                  onChange={(e) => setDraft({ ...draft, video_url: e.target.value })}
                  className="input"
                  placeholder="https://..."
                />
              </Field>

              <Field label={t('admin.curriculum.f_materials')}>
                <textarea
                  value={draft.materials}
                  onChange={(e) => setDraft({ ...draft, materials: e.target.value })}
                  rows={3}
                  className="input resize-none"
                  placeholder={t('admin.curriculum.f_materials_ph')}
                />
                <p className="text-faint mt-1 text-xs">{t('admin.curriculum.f_materials_hint')}</p>
              </Field>

              <label className="flex items-center justify-between py-1">
                <span className="text-sm font-medium">{t('admin.curriculum.f_preview')}</span>
                <input
                  type="checkbox"
                  checked={draft.is_preview}
                  onChange={(e) => setDraft({ ...draft, is_preview: e.target.checked })}
                  className="h-5 w-5 accent-[#6366f1]"
                />
              </label>

              <label className="flex items-center justify-between py-1">
                <span className="text-sm font-medium">{t('admin.curriculum.f_active')}</span>
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-5 w-5 accent-[#6366f1]"
                />
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              {draft.id && (
                <button
                  onClick={handleDelete}
                  disabled={del.isPending}
                  className="bg-danger/15 text-danger border-danger/30 press rounded-2xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {t('admin.curriculum.delete')}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={upsert.isPending}
                className="glass-btn press flex-1 rounded-2xl py-3 text-sm font-semibold disabled:opacity-60"
              >
                {upsert.isPending ? t('admin.users.saving') : t('admin.curriculum.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-tg-hint mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
