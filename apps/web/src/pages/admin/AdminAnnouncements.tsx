/**
 * AdminAnnouncements — бегущая строка (SUPER_ADMIN).
 * 3 стиля-пресета, превью, активность. Route: /admin/announcements
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useBackButton } from '../../hooks/useBackButton';
import {
  useAdminAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  type AdminAnnouncement,
  type AnnouncementStyle,
  type AnnouncementPosition,
  type AnnouncementRecurrence,
  type AudienceRole,
} from '../../api/announcements';

const STYLES: AnnouncementStyle[] = ['CAUTION', 'INFO', 'PROMO'];
const POSITIONS: AnnouncementPosition[] = ['TOP', 'BOTTOM'];
const AUDIENCE_ROLES: AudienceRole[] = ['STUDENT', 'TEACHER', 'MANAGER', 'PARENT', 'ADMIN'];
const RECURRENCES: AnnouncementRecurrence[] = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'];
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]; // вс-сб
const STYLE_CLASS: Record<AnnouncementStyle, string> = {
  CAUTION: 'll-ann-caution',
  INFO: 'll-ann-info',
  PROMO: 'll-ann-promo',
};

// Длительность показа. -1 = не менять (при редактировании), 0 = бессрочно.
const DURATIONS: { v: number; key: string }[] = [
  { v: 0, key: 'dur_forever' },
  { v: 60, key: 'dur_1h' },
  { v: 360, key: 'dur_6h' },
  { v: 1440, key: 'dur_1d' },
  { v: 4320, key: 'dur_3d' },
  { v: 10080, key: 'dur_7d' },
];

type Draft = {
  id?: string;
  text: string;
  style: AnnouncementStyle;
  position: AnnouncementPosition;
  is_active: boolean;
  sort_order: number;
  duration: number; // -1 = не менять
  broadcast: boolean;
  audienceRoles: AudienceRole[];
  targetUsername: string;
  recurrence: AnnouncementRecurrence;
  recurrenceDay: number;
};

const EMPTY: Draft = {
  text: '',
  style: 'CAUTION',
  position: 'TOP',
  is_active: true,
  sort_order: 0,
  duration: 0,
  broadcast: true,
  audienceRoles: [],
  targetUsername: '',
  recurrence: 'NONE',
  recurrenceDay: 1,
};

function toDraft(a: AdminAnnouncement): Draft {
  return {
    id: a.id,
    text: a.text,
    style: a.style,
    position: a.position,
    is_active: a.is_active,
    sort_order: a.sort_order,
    duration: -1, // редактирование: по умолчанию не трогаем срок
    broadcast: false,
    audienceRoles: a.audience_roles ?? [],
    targetUsername: a.target_username ?? '',
    recurrence: a.recurrence ?? 'NONE',
    recurrenceDay: a.recurrence_day ?? 1,
  };
}

export function AdminAnnouncementsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: items, isLoading } = useAdminAnnouncements();
  const createMut = useCreateAnnouncement();
  const updateMut = useUpdateAnnouncement();
  const deleteMut = useDeleteAnnouncement();

  const [draft, setDraft] = useState<Draft | null>(null);
  const saving = createMut.isPending || updateMut.isPending;

  useBackButton(() => {
    if (draft) setDraft(null);
    else navigate('/admin');
  });

  const handleSave = () => {
    if (!draft) return;
    if (!draft.text.trim()) {
      WebApp.showAlert(t('admin.announce.required'));
      return;
    }
    const payload = {
      text: draft.text.trim(),
      style: draft.style,
      position: draft.position,
      is_active: draft.is_active,
      sort_order: draft.sort_order,
      audience_roles: draft.audienceRoles,
      target_username: draft.targetUsername.trim(),
      recurrence: draft.recurrence,
      recurrence_day: draft.recurrence === 'NONE' ? null : draft.recurrenceDay,
      // duration отправляем только если задано (-1 = не менять)
      ...(draft.duration >= 0 ? { duration_minutes: draft.duration } : {}),
    };
    const onDone = {
      onSuccess: () => setDraft(null),
      onError: (e: unknown) =>
        WebApp.showAlert(e instanceof Error ? e.message : t('admin.announce.required')),
    };
    if (draft.id) updateMut.mutate({ id: draft.id, ...payload }, onDone);
    else createMut.mutate({ ...payload, broadcast: draft.broadcast }, onDone);
  };

  const handleDelete = () => {
    if (!draft?.id) return;
    WebApp.showConfirm(t('admin.announce.delete_confirm'), (ok) => {
      if (!ok || !draft.id) return;
      deleteMut.mutate(draft.id, { onSuccess: () => setDraft(null) });
    });
  };

  const styleLabel = (s: AnnouncementStyle) => t(`admin.announce.style_${s.toLowerCase()}`);

  return (
    <div className="glass-fade-in min-h-screen px-4 pb-8 pt-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">📣 {t('admin.announce.title')}</h1>
          <p className="text-tg-hint text-sm">{t('admin.announce.desc')}</p>
        </div>
        <button
          onClick={() => setDraft({ ...EMPTY })}
          className="glass-btn press rounded-xl px-3 py-2 text-sm font-semibold"
        >
          + {t('admin.announce.add')}
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
        </div>
      ) : !items?.length ? (
        <div className="py-12 text-center">
          <p className="mb-2 text-4xl">📣</p>
          <p className="text-tg-hint text-sm">{t('admin.announce.empty')}</p>
        </div>
      ) : (
        <div className="stagger flex flex-col gap-3">
          {items.map((a) => (
            <button
              key={a.id}
              onClick={() => setDraft(toDraft(a))}
              className="glass-card press overflow-hidden rounded-2xl text-left"
            >
              {/* мини-превью полосы (статично) */}
              <div className={`${STYLE_CLASS[a.style]} truncate px-4 py-1.5 text-xs font-bold`}>
                {a.text}
              </div>
              <div className="flex items-center justify-between px-4 py-2">
                <span className="text-tg-hint text-xs">
                  {styleLabel(a.style)} · {t(`admin.announce.pos_${a.position.toLowerCase()}`)}
                  {a.expires_at && new Date(a.expires_at) > new Date() && (
                    <>
                      {' · '}
                      {t('admin.announce.until', {
                        date: new Date(a.expires_at).toLocaleString(i18n.language, {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        }),
                      })}
                    </>
                  )}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-semibold"
                  style={{
                    background: a.is_active ? 'rgba(16,185,129,0.15)' : 'var(--surface-2)',
                    color: a.is_active ? '#10B981' : 'var(--faint)',
                  }}
                >
                  {a.is_active ? t('admin.announce.on') : t('admin.announce.off')}
                </span>
              </div>
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
              {draft.id ? t('admin.announce.edit') : t('admin.announce.add')}
            </h3>

            {/* Live preview */}
            <div className="mb-4 overflow-hidden rounded-xl">
              <div className={`ll-marquee-bar ${STYLE_CLASS[draft.style]}`}>
                <div className="ll-marquee-track">
                  <span>{draft.text || t('admin.announce.preview_ph')}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {t('admin.announce.f_text')}
                </label>
                <textarea
                  value={draft.text}
                  onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                  rows={2}
                  maxLength={200}
                  className="input resize-none"
                  placeholder={t('admin.announce.f_text_ph')}
                />
              </div>

              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {t('admin.announce.f_style')}
                </label>
                <div className="flex gap-2">
                  {STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setDraft({ ...draft, style: s })}
                      className="press flex-1 rounded-xl px-2 py-2 text-xs font-semibold"
                      style={{
                        background: draft.style === s ? 'var(--surface-2)' : 'transparent',
                        border: `2px solid ${draft.style === s ? '#6C5CE7' : 'var(--hairline)'}`,
                      }}
                    >
                      {styleLabel(s)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Позиция: верх / низ (как новости) */}
              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {t('admin.announce.f_position')}
                </label>
                <div className="flex gap-2">
                  {POSITIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setDraft({ ...draft, position: p })}
                      className="press flex-1 rounded-xl px-2 py-2 text-xs font-semibold"
                      style={{
                        background: draft.position === p ? 'var(--surface-2)' : 'transparent',
                        border: `2px solid ${draft.position === p ? '#6C5CE7' : 'var(--hairline)'}`,
                      }}
                    >
                      {t(`admin.announce.pos_${p.toLowerCase()}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Длительность показа */}
              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {t('admin.announce.f_duration')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {draft.id && (
                    <button
                      onClick={() => setDraft({ ...draft, duration: -1 })}
                      className="press rounded-xl px-3 py-1.5 text-xs font-semibold"
                      style={{
                        background: draft.duration === -1 ? 'var(--surface-2)' : 'transparent',
                        border: `2px solid ${draft.duration === -1 ? '#6C5CE7' : 'var(--hairline)'}`,
                      }}
                    >
                      {t('admin.announce.dur_keep')}
                    </button>
                  )}
                  {DURATIONS.map((d) => (
                    <button
                      key={d.v}
                      onClick={() => setDraft({ ...draft, duration: d.v })}
                      className="press rounded-xl px-3 py-1.5 text-xs font-semibold"
                      style={{
                        background: draft.duration === d.v ? 'var(--surface-2)' : 'transparent',
                        border: `2px solid ${draft.duration === d.v ? '#6C5CE7' : 'var(--hairline)'}`,
                      }}
                    >
                      {t(`admin.announce.${d.key}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Аудитория: роли */}
              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {t('admin.announce.f_audience')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCE_ROLES.map((r) => {
                    const on = draft.audienceRoles.includes(r);
                    return (
                      <button
                        key={r}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            audienceRoles: on
                              ? draft.audienceRoles.filter((x) => x !== r)
                              : [...draft.audienceRoles, r],
                          })
                        }
                        className="press rounded-xl px-3 py-1.5 text-xs font-semibold"
                        style={{
                          background: on ? 'var(--surface-2)' : 'transparent',
                          border: `2px solid ${on ? '#6C5CE7' : 'var(--hairline)'}`,
                        }}
                      >
                        {t(`profile.role_${r.toLowerCase()}`)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-faint mt-1 text-xs">{t('admin.announce.f_audience_hint')}</p>
              </div>

              {/* Конкретный пользователь */}
              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {t('admin.announce.f_target')}
                </label>
                <input
                  value={draft.targetUsername}
                  onChange={(e) => setDraft({ ...draft, targetUsername: e.target.value })}
                  className="input"
                  placeholder="@username"
                />
                <p className="text-faint mt-1 text-xs">{t('admin.announce.f_target_hint')}</p>
              </div>

              {/* Регулярность */}
              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {t('admin.announce.f_recurrence')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {RECURRENCES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setDraft({ ...draft, recurrence: r })}
                      className="press rounded-xl px-3 py-1.5 text-xs font-semibold"
                      style={{
                        background: draft.recurrence === r ? 'var(--surface-2)' : 'transparent',
                        border: `2px solid ${draft.recurrence === r ? '#6C5CE7' : 'var(--hairline)'}`,
                      }}
                    >
                      {t(`admin.announce.rec_${r.toLowerCase()}`)}
                    </button>
                  ))}
                </div>

                {draft.recurrence === 'MONTHLY' && (
                  <div className="mt-2">
                    <label className="text-faint mb-1 block text-xs">
                      {t('admin.announce.rec_dom')}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={draft.recurrenceDay}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          recurrenceDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                        })
                      }
                      className="input"
                    />
                  </div>
                )}

                {draft.recurrence === 'WEEKLY' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDraft({ ...draft, recurrenceDay: d })}
                        className="press rounded-xl px-3 py-1.5 text-xs font-semibold"
                        style={{
                          background:
                            draft.recurrenceDay === d ? 'var(--surface-2)' : 'transparent',
                          border: `2px solid ${draft.recurrenceDay === d ? '#6C5CE7' : 'var(--hairline)'}`,
                        }}
                      >
                        {t(`schedule.day_${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d]}`)}
                      </button>
                    ))}
                  </div>
                )}

                {draft.recurrence !== 'NONE' && (
                  <p className="text-faint mt-1 text-xs">{t('admin.announce.rec_hint')}</p>
                )}
              </div>

              {/* Рассылка в чат + уведомления (только при создании) */}
              {!draft.id && (
                <label className="bg-surface flex items-center justify-between rounded-xl px-3 py-2.5">
                  <span className="min-w-0 flex-1 pr-3">
                    <span className="block text-sm font-medium">
                      {t('admin.announce.f_broadcast')}
                    </span>
                    <span className="text-faint block text-xs">
                      {t('admin.announce.f_broadcast_hint')}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.broadcast}
                    onChange={(e) => setDraft({ ...draft, broadcast: e.target.checked })}
                    className="h-5 w-5 shrink-0 accent-[#6C5CE7]"
                  />
                </label>
              )}

              <div>
                <label className="text-tg-hint mb-1 block text-xs font-medium">
                  {t('admin.announce.f_order')}
                </label>
                <input
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })}
                  className="input"
                />
              </div>

              <label className="flex items-center justify-between py-1">
                <span className="text-sm font-medium">{t('admin.announce.f_active')}</span>
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-5 w-5 accent-[#6C5CE7]"
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
