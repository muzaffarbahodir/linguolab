/**
 * AdminTeachers — список учителей, создание и редактирование.
 * Route: /admin/teachers
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { useBackButton } from '../../hooks/useBackButton';

import {
  useAdminTeachers,
  useCreateTeacher,
  useUpdateTeacher,
  useDeleteTeacher,
  type AdminTeacher,
} from '../../api/admin';
import {
  useTeacherProfile,
  useAwardBadge,
  useRemoveBadge,
  useSetTeacherHighlights,
} from '../../api/teachers';
import { useAuthStore } from '../../store/auth';
import { TeacherShowcaseFields } from '../../components/TeacherShowcaseFields';
import {
  emptyShowcase,
  showcaseFromProfile,
  showcaseToPayload,
  type ShowcaseDraft,
} from '../../components/teacher-showcase-draft';

// ── BadgeSheet ────────────────────────────────────────────────────────────────

const PRESET_ICONS = ['⭐', '🏆', '🎓', '🔥', '💎', '🌟', '🎯', '✅', '🚀', '❤️'];

/**
 * Черты преподавателя для витрины.
 *
 * Готовый набор, а не свободный ввод: так они одинаково звучат у всех
 * преподавателей и их можно сравнивать между профилями. Ставит менеджер —
 * себе такую оценку не выдают.
 *
 * Формулировки безличные («Терпеливо объясняет», а не «Терпеливый») —
 * прилагательное в русском требует рода, и один и тот же набор не подошёл бы
 * и преподавателю, и преподавательнице.
 */
const PRESET_HIGHLIGHTS = [
  'Терпеливо объясняет',
  'Структурные занятия',
  'Мотивирует',
  'Разговорная практика',
  'Готовит к экзаменам',
  'Работает с детьми',
  'Ставит произношение',
  'Держит дисциплину',
];

/** Максимум на витрине — больше шести перестают читаться как выделенное. */
const MAX_HIGHLIGHTS = 6;

function BadgeSheet({ teacherId, onClose }: { teacherId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: profile } = useTeacherProfile(teacherId);
  const award = useAwardBadge();
  const remove = useRemoveBadge();
  const setHighlights = useSetTeacherHighlights();
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [desc, setDesc] = useState('');
  const [picked, setPicked] = useState<string[] | null>(null);

  // null — профиль ещё не загружен; отличаем от «менеджер снял все черты».
  const current = picked ?? profile?.highlights ?? [];
  const dirty = picked !== null;

  function toggleHighlight(h: string) {
    setPicked((prev) => {
      const base = prev ?? profile?.highlights ?? [];
      if (base.includes(h)) return base.filter((x) => x !== h);
      if (base.length >= MAX_HIGHLIGHTS) return base;
      return [...base, h];
    });
  }

  function handleSaveHighlights() {
    setHighlights.mutate(
      { teacherId, highlights: current },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          setPicked(null);
        },
        onError: () => WebApp.showAlert(t('admin.teachers.award_error')),
      },
    );
  }

  function handleAward() {
    if (!title.trim()) return;
    award.mutate(
      { teacherId, title: title.trim(), icon, description: desc.trim() || undefined },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          setTitle('');
          setDesc('');
        },
        onError: () => WebApp.showAlert(t('admin.teachers.award_error')),
      },
    );
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--hairline)',
    color: '#fff',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/65" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl px-5 pb-10 pt-5"
        style={{ background: '#1a2538' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <h2 className="mb-4 font-bold">{t('admin.teachers.badges_title')}</h2>

        {/* Current badges */}
        {profile?.badges?.length ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {profile.badges.map((b) => (
              <div key={b.id} className="bg-brand/15 flex items-center gap-1 rounded-xl px-2 py-1">
                <span>{b.icon}</span>
                <span className="text-xs font-medium">{b.title}</span>
                <button
                  onClick={() => remove.mutate(b.id)}
                  disabled={remove.isPending}
                  className="text-danger ml-1 text-xs opacity-50 hover:opacity-100"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-faint mb-4 text-xs">{t('admin.teachers.no_badges')}</p>
        )}

        {/* Черты для витрины */}
        <p className="text-muted mb-2 text-xs font-semibold">
          {t('admin.teachers.highlights_title')}
        </p>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PRESET_HIGHLIGHTS.map((h) => {
            const active = current.includes(h);
            return (
              <button
                key={h}
                onClick={() => toggleHighlight(h)}
                className={`press rounded-xl px-2.5 py-1.5 text-xs font-medium ${
                  active ? 'bg-brand/30 text-brand-400' : 'bg-surface-2 text-muted'
                }`}
              >
                {h}
              </button>
            );
          })}
        </div>
        {dirty && (
          <button
            onClick={handleSaveHighlights}
            disabled={setHighlights.isPending}
            className="press bg-brand mb-4 w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {setHighlights.isPending ? '...' : t('teacher.save')}
          </button>
        )}
        {!dirty && <div className="mb-4" />}

        {/* New badge form */}
        <p className="text-muted mb-2 text-xs font-semibold">{t('admin.teachers.award_badge')}</p>

        <div className="mb-3 flex flex-wrap gap-2">
          {PRESET_ICONS.map((i) => (
            <button
              key={i}
              onClick={() => setIcon(i)}
              className={`press h-9 w-9 rounded-xl text-xl ${icon === i ? 'bg-brand/40' : 'bg-surface-2'}`}
            >
              {i}
            </button>
          ))}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('admin.teachers.badge_name_ph')}
          className="mb-2 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder={t('admin.teachers.badge_desc_ph')}
          className="mb-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />

        <button
          onClick={handleAward}
          disabled={award.isPending || !title.trim()}
          className="press w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#FCD34D)', color: '#1a1a1a' }}
        >
          {award.isPending ? '...' : `${icon} ${t('admin.teachers.award_btn')}`}
        </button>
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function teacherName(t: AdminTeacher) {
  return `${t.user.first_name}${t.user.last_name ? ' ' + t.user.last_name : ''}`;
}

// ── TeacherForm ───────────────────────────────────────────────────────────────

function TeacherForm({
  initial,
  onClose,
  isEdit,
}: {
  initial?: AdminTeacher;
  onClose: () => void;
  isEdit: boolean;
}) {
  const { t } = useTranslation();
  const create = useCreateTeacher();
  const update = useUpdateTeacher();

  const [firstName, setFirstName] = useState(initial?.user.first_name ?? '');
  const [lastName, setLastName] = useState(initial?.user.last_name ?? '');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [showcase, setShowcase] = useState<ShowcaseDraft>(emptyShowcase);

  // Витрина лежит в профиле преподавателя, а не в админском списке — тянем её
  // отдельно, когда сheet открыт на редактирование.
  const { data: profile } = useTeacherProfile(isEdit && initial ? initial.id : '');
  useEffect(() => {
    if (profile) setShowcase(showcaseFromProfile(profile));
  }, [profile]);

  const isPending = create.isPending || update.isPending;

  function handleSave() {
    if (!firstName.trim()) return;
    if (isEdit && initial) {
      update.mutate(
        {
          id: initial.id,
          ...showcaseToPayload(showcase),
          first_name: firstName.trim(),
          last_name: lastName.trim() || undefined,
          bio: bio.trim() || undefined,
        },
        {
          onSuccess: () => {
            WebApp.HapticFeedback.notificationOccurred('success');
            onClose();
          },
          onError: () => WebApp.showAlert(t('admin.teachers.save_error')),
        },
      );
    } else {
      if (!email.trim()) return;
      create.mutate(
        {
          first_name: firstName.trim(),
          last_name: lastName.trim() || undefined,
          email: email.trim(),
          bio: bio.trim() || undefined,
        },
        {
          onSuccess: () => {
            WebApp.HapticFeedback.notificationOccurred('success');
            onClose();
          },
          onError: () => WebApp.showAlert(t('admin.teachers.create_error')),
        },
      );
    }
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--hairline)',
    color: '#fff',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/65" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl px-5 pb-10 pt-5"
        style={{ background: '#1a2538' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />
        <h2 className="mb-4 font-bold">
          {isEdit ? t('admin.teachers.edit_title') : t('admin.teachers.create_title')}
        </h2>

        <div className="flex gap-2">
          <div className="flex-1">
            <p className="text-muted mb-1 text-xs">{t('admin.teachers.name_label')}</p>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder={t('admin.teachers.name_ph')}
              className="mb-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div className="flex-1">
            <p className="text-muted mb-1 text-xs">{t('admin.teachers.lastname_label')}</p>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder={t('admin.teachers.lastname_ph')}
              className="mb-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </div>
        </div>

        {!isEdit && (
          <>
            <p className="text-muted mb-1 text-xs">{t('admin.teachers.email_label')}</p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              type="email"
              className="mb-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </>
        )}

        <p className="text-muted mb-1 text-xs">{t('admin.teachers.bio_label')}</p>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('admin.teachers.bio_ph')}
          rows={3}
          maxLength={2000}
          className="mb-4 w-full resize-none rounded-xl px-3 py-2.5 text-sm outline-none"
          style={inputStyle}
        />

        {/*
          Витрина — только при редактировании: у ещё не созданного
          преподавателя нет id, а без него некуда грузить видео.
          Заполняет её менеджер, потому что заведённый через админку
          преподаватель в Telegram не заходит и своей формы не увидит.
        */}
        {isEdit && (
          <div className="mb-4">
            <TeacherShowcaseFields value={showcase} onChange={setShowcase} />
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isPending || !firstName.trim() || (!isEdit && !email.trim())}
          className="press w-full rounded-xl py-3 font-semibold text-white disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#6366f1,#a5b4fc)' }}
        >
          {isPending ? '...' : isEdit ? t('admin.teachers.save') : t('admin.teachers.create')}
        </button>
      </div>
    </div>
  );
}

// ── TeacherCard ───────────────────────────────────────────────────────────────

function TeacherCard({ teacher, canDelete }: { teacher: AdminTeacher; canDelete: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deleteTeacher = useDeleteTeacher();
  const [showEdit, setShowEdit] = useState(false);
  const [showBadges, setShowBadges] = useState(false);

  const name = teacherName(teacher);

  function handleDelete() {
    WebApp.showConfirm(t('admin.teachers.delete_confirm', { name }), (ok) => {
      if (!ok) return;
      deleteTeacher.mutate(teacher.id, {
        onSuccess: () => WebApp.HapticFeedback.notificationOccurred('success'),
        onError: () => WebApp.showAlert(t('admin.teachers.delete_error')),
      });
    });
  }

  return (
    <>
      <div className="bg-surface border-hairline rounded-2xl border p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#818cf8)' }}
          >
            {teacher.user.avatar_url ? (
              <img
                src={teacher.user.avatar_url}
                alt=""
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              name[0]?.toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <button
              onClick={() => navigate(`/teachers/${teacher.id}`)}
              className="text-left font-semibold leading-tight hover:underline"
            >
              {name}
            </button>
            {teacher.user.telegram_username && (
              <p className="text-muted text-xs">@{teacher.user.telegram_username}</p>
            )}
            <div className="text-muted mt-1 flex items-center gap-3 text-xs">
              <span>🎓 {t('admin.teachers.classes_count', { n: teacher.classes_count })}</span>
              {teacher.avg_rating != null && <span>⭐ {teacher.avg_rating.toFixed(1)}</span>}
            </div>
            {teacher.bio && <p className="text-faint mt-1 text-xs italic">{teacher.bio}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => setShowEdit(true)}
              className="bg-brand/15 text-brand-400 press rounded-lg px-2 py-1 text-xs font-medium"
            >
              ✏️
            </button>
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleteTeacher.isPending}
                className="bg-danger/10 text-danger press rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-40"
              >
                🗑
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Badge button */}
      <button
        onClick={() => setShowBadges(true)}
        className="bg-warn/10 text-warn press mt-2 w-full rounded-xl py-1.5 text-xs font-medium"
      >
        🏆 {t('admin.teachers.badges_btn')}
      </button>
      {showEdit && <TeacherForm initial={teacher} isEdit onClose={() => setShowEdit(false)} />}
      {showBadges && <BadgeSheet teacherId={teacher.id} onClose={() => setShowBadges(false)} />}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminTeachersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canDelete = role === 'ADMIN' || role === 'SUPER_ADMIN';

  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const { data, isLoading } = useAdminTeachers(page);

  useBackButton(() => navigate('/admin'));

  return (
    <div className="glass-fade-in min-h-screen pb-10">
      <div className="glass border-surface-2 border-b px-4 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">👨‍🏫 {t('admin.teachers.title')}</h1>
            {data && (
              <p className="text-muted text-xs">{t('admin.teachers.total', { n: data.total })}</p>
            )}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="press rounded-xl px-3 py-1.5 text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#a5b4fc)' }}
          >
            {t('admin.teachers.add')}
          </button>
        </div>
      </div>

      <div className="stagger flex flex-col gap-3 px-4 py-4">
        {isLoading && (
          <div className="flex justify-center py-16">
            <div className="border-brand/30 border-t-brand h-7 w-7 animate-spin rounded-full border-4" />
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-4xl">👨‍🏫</span>
            <p className="font-bold">{t('admin.teachers.no_teachers')}</p>
          </div>
        )}

        {data?.items.map((teacher) => (
          <TeacherCard key={teacher.id} teacher={teacher} canDelete={canDelete} />
        ))}

        {/* Pagination */}
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

      {showCreate && <TeacherForm isEdit={false} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
