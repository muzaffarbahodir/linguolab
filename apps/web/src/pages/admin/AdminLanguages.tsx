/**
 * AdminLanguages — управление языками (SUPER_ADMIN).
 * Картинка вместо цвета, описание, флаг, активность.
 * Route: /admin/languages
 */
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useBackButton } from '../../hooks/useBackButton';
import { ImageUploadField } from '../../components/ImageUploadField';
import {
  useAdminLanguages,
  useCreateLanguage,
  useUpdateLanguage,
  useDeleteLanguage,
  type AdminLanguage,
} from '../../api/admin';
import type { LanguageCategory } from '../../api/languages';

/** Категории направлений для селектора (значение enum → подпись). */
const CATEGORIES: { value: LanguageCategory; label: string }[] = [
  { value: 'LANGUAGES', label: 'Языки' },
  { value: 'IELTS', label: 'IELTS' },
  { value: 'SAT', label: 'SAT' },
  { value: 'CEFR', label: 'CEFR' },
  { value: 'DTM', label: 'DTM' },
  { value: 'MILLIY_SERTIFIKAT', label: 'Milliy sertifikat' },
];

type Draft = {
  id?: string;
  code: string;
  name_ru: string;
  flag_emoji: string;
  category: LanguageCategory;
  color: string;
  image_url: string;
  description: string;
  duration_label: string;
  includes: string; // по строке на пункт
  requirements: string; // по строке на пункт
  is_active: boolean;
};

const EMPTY: Draft = {
  code: '',
  name_ru: '',
  flag_emoji: '',
  category: 'LANGUAGES',
  color: '#6366f1',
  image_url: '',
  description: '',
  duration_label: '',
  includes: '',
  requirements: '',
  is_active: true,
};

const toLines = (s: string) =>
  s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

function toDraft(l: AdminLanguage): Draft {
  return {
    id: l.id,
    code: l.code,
    name_ru: l.name_ru,
    flag_emoji: l.flag_emoji,
    category: l.category ?? 'LANGUAGES',
    color: l.color ?? '#6366f1',
    image_url: l.image_url ?? '',
    description: l.description ?? '',
    duration_label: l.duration_label ?? '',
    includes: (l.includes ?? []).join('\n'),
    requirements: (l.requirements ?? []).join('\n'),
    is_active: l.is_active,
  };
}

export function AdminLanguagesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: languages, isLoading } = useAdminLanguages();
  const createMut = useCreateLanguage();
  const updateMut = useUpdateLanguage();
  const deleteMut = useDeleteLanguage();

  const [draft, setDraft] = useState<Draft | null>(null);

  useBackButton(() => {
    if (draft) setDraft(null);
    else navigate('/admin');
  });

  const saving = createMut.isPending || updateMut.isPending;

  const handleSave = () => {
    if (!draft) return;
    if (!draft.name_ru.trim() || !draft.code.trim()) {
      WebApp.showAlert(t('admin.languages.required'));
      return;
    }
    const payload = {
      code: draft.code.trim(),
      name_ru: draft.name_ru.trim(),
      flag_emoji: draft.flag_emoji.trim(),
      category: draft.category,
      color: draft.color || null,
      image_url: draft.image_url.trim() || null,
      description: draft.description.trim() || null,
      duration_label: draft.duration_label.trim() || null,
      includes: toLines(draft.includes),
      requirements: toLines(draft.requirements),
      is_active: draft.is_active,
    };
    const onDone = { onSuccess: () => setDraft(null) };
    if (draft.id) updateMut.mutate({ id: draft.id, ...payload }, onDone);
    else createMut.mutate(payload, onDone);
  };

  const handleDelete = () => {
    if (!draft?.id) return;
    WebApp.showConfirm(t('admin.languages.delete_confirm'), (ok) => {
      if (!ok || !draft.id) return;
      deleteMut.mutate(draft.id, { onSuccess: () => setDraft(null) });
    });
  };

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🌐 {t('admin.languages.title')}</h1>
          <p className="text-tg-hint text-sm">{t('admin.languages.desc')}</p>
        </div>
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="glass-btn press rounded-xl px-3 py-2 text-sm font-semibold"
        >
          + {t('admin.languages.add')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
        </div>
      ) : !languages?.length ? (
        <div className="py-12 text-center">
          <p className="mb-2 text-4xl">🌐</p>
          <p className="text-tg-hint text-sm">{t('admin.languages.empty')}</p>
        </div>
      ) : (
        <div className="stagger flex flex-col gap-2">
          {languages.map((l) => (
            <button
              key={l.id}
              onClick={() => setDraft(toDraft(l))}
              className="glass-card press flex items-center gap-3 rounded-2xl p-3 text-left"
            >
              {/* Preview: картинка или цвет */}
              <div
                className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl"
                style={l.image_url ? undefined : { background: l.color ?? '#6366f1' }}
              >
                {l.image_url ? (
                  <img src={l.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{l.flag_emoji}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {l.name_ru}{' '}
                  <span className="text-tg-hint text-xs font-normal">{l.code.toUpperCase()}</span>
                </p>
                {l.description && <p className="text-tg-hint truncate text-xs">{l.description}</p>}
              </div>
              {!l.is_active && (
                <span className="bg-surface-2 text-faint rounded-full px-2 py-0.5 text-xs">
                  {t('admin.languages.hidden')}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Edit / create sheet */}
      {draft && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDraft(null);
          }}
        >
          <div
            className="glass-card max-h-[90vh] overflow-y-auto rounded-t-3xl p-6"
            style={{
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              background: 'var(--secondary-bg)',
            }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h3 className="mb-4 text-base font-bold">
              {draft.id ? t('admin.languages.edit') : t('admin.languages.add')}
            </h3>

            <div className="flex flex-col gap-3">
              <Field label={t('admin.languages.f_name')}>
                <input
                  value={draft.name_ru}
                  onChange={(e) => setDraft({ ...draft, name_ru: e.target.value })}
                  className="input"
                  placeholder="Английский"
                />
              </Field>

              <Field label="Категория">
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({ ...draft, category: e.target.value as LanguageCategory })
                  }
                  className="input"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="flex gap-3">
                <Field label={t('admin.languages.f_code')} className="flex-1">
                  <input
                    value={draft.code}
                    onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                    className="input"
                    placeholder="en"
                    maxLength={8}
                  />
                </Field>
                <Field label={t('admin.languages.f_flag')} className="w-24">
                  <input
                    value={draft.flag_emoji}
                    onChange={(e) => setDraft({ ...draft, flag_emoji: e.target.value })}
                    className="input"
                    placeholder="🇬🇧"
                    maxLength={8}
                  />
                </Field>
              </div>

              <Field label={t('admin.languages.f_image')}>
                <ImageUploadField
                  value={draft.image_url}
                  onChange={(url) => setDraft({ ...draft, image_url: url })}
                />
              </Field>

              <Field label={t('admin.languages.f_color')}>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    className="h-10 w-14 shrink-0 rounded-lg border-0 bg-transparent p-0"
                  />
                  <input
                    value={draft.color}
                    onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                    className="input flex-1"
                    placeholder="#6366f1"
                  />
                </div>
                <p className="text-faint mt-1 text-xs">{t('admin.languages.f_color_hint')}</p>
              </Field>

              <Field label={t('admin.languages.f_description')}>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={3}
                  maxLength={500}
                  className="input resize-none"
                  placeholder={t('admin.languages.f_description_ph')}
                />
              </Field>

              <Field label={t('admin.languages.f_duration')}>
                <input
                  value={draft.duration_label}
                  onChange={(e) => setDraft({ ...draft, duration_label: e.target.value })}
                  className="input"
                  placeholder={t('class_req.duration_course_ph')}
                  maxLength={120}
                />
              </Field>

              <Field label={t('admin.languages.f_includes')}>
                <textarea
                  value={draft.includes}
                  onChange={(e) => setDraft({ ...draft, includes: e.target.value })}
                  rows={3}
                  className="input resize-none"
                  placeholder={t('class_req.includes_ph')}
                />
              </Field>

              <Field label={t('admin.languages.f_requirements')}>
                <textarea
                  value={draft.requirements}
                  onChange={(e) => setDraft({ ...draft, requirements: e.target.value })}
                  rows={3}
                  className="input resize-none"
                  placeholder={t('class_req.requirements_ph')}
                />
              </Field>

              <label className="flex items-center justify-between py-1">
                <span className="text-sm font-medium">{t('admin.languages.f_active')}</span>
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
                  disabled={deleteMut.isPending}
                  className="bg-danger/15 text-danger border-danger/30 press rounded-2xl border px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {t('admin.languages.delete')}
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="glass-btn press flex-1 rounded-2xl py-3 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? t('admin.users.saving') : t('admin.languages.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-tg-hint mb-1 block text-xs font-medium">{label}</label>
      {children}
    </div>
  );
}
