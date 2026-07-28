import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';

import { useTeacherProfileByUserId, useUpdateTeacherProfile } from '../../api/teachers';
import { uploadImage } from '../../api/uploads';
import { toast } from '../../store/toast';
import { TeacherShowcaseFields } from '../../components/TeacherShowcaseFields';
import {
  emptyShowcase,
  showcaseFromProfile,
  showcaseToPayload,
  type ShowcaseDraft,
} from '../../components/teacher-showcase-draft';
import { Button, cx } from '../../components/ui';

const FIELD =
  'bg-surface-2 border-hairline w-full rounded-2xl border px-4 py-2.5 text-sm text-[color:var(--text)] outline-none';

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-muted mb-1 mt-3 block text-xs font-medium">{children}</label>;
}

/**
 * Редактор профиля преподавателя.
 *
 * Вынесен из TeacherHome отдельным файлом: с появлением витрины (видео,
 * языки, направления) форма стала больше самой страницы кабинета.
 *
 * Черт (highlights) здесь намеренно нет — их ставит менеджер. Оценку
 * «терпеливо объясняет» человек не выдаёт себе сам, иначе она ничего не стоит.
 */
export function EditProfileSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: profile } = useTeacherProfileByUserId(userId);
  const update = useUpdateTeacherProfile();

  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showcase, setShowcase] = useState<ShowcaseDraft>(emptyShowcase);
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');
  const [done, setDone] = useState(false);

  // Профиль может прийти уже после монтирования — подхватываем значения.
  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? '');
    setPhoto(profile.photo_url ?? '');
    setShowcase(showcaseFromProfile(profile));
    setWebsite(profile.website_url ?? '');
    setInstagram(profile.instagram_url ?? '');
    setTelegram(profile.telegram_url ?? '');
  }, [profile]);

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволяем выбрать тот же файл повторно
    if (!file) return;
    setUploading(true);
    try {
      setPhoto(await uploadImage(file));
      WebApp.HapticFeedback.notificationOccurred('success');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('teacher.save_error'));
    } finally {
      setUploading(false);
    }
  }

  function handleSave() {
    update.mutate(
      {
        ...showcaseToPayload(showcase),
        bio: bio.trim() || undefined,
        photo_url: photo.trim() ? photo.trim() : null,
        website_url: website.trim() || undefined,
        instagram_url: instagram.trim() || undefined,
        telegram_url: telegram.trim() || undefined,
      },
      {
        onSuccess: () => {
          WebApp.HapticFeedback.notificationOccurred('success');
          setDone(true);
          setTimeout(onClose, 900);
        },
        onError: () => toast.error(t('teacher.save_error')),
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/65" onClick={onClose}>
      <div
        className="border-hairline bg-surface max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border px-5 pb-10 pt-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-surface-2 mx-auto mb-4 h-1 w-10 rounded-full" />

        {done ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="text-4xl">✅</span>
            <p className="font-bold text-[color:var(--text)]">{t('teacher.profile_updated')}</p>
          </div>
        ) : (
          <>
            <h2 className="mb-4 text-base font-bold text-[color:var(--text)]">
              {t('teacher.edit_profile')}
            </h2>

            {/* Фото */}
            <div className="mb-2 flex items-center gap-4">
              <div className="bg-surface-2 h-16 w-16 shrink-0 overflow-hidden rounded-full">
                {(photo || profile?.user.avatar_url) && (
                  <img
                    src={photo || profile?.user.avatar_url || ''}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="bg-surface-2 press inline-block cursor-pointer rounded-xl px-3 py-2 text-xs font-semibold text-[color:var(--text)]">
                  {uploading ? t('teacher.photo_uploading') : t('teacher.photo_change')}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handlePhotoPick(e)}
                    disabled={uploading}
                    className="hidden"
                  />
                </label>
                {photo && (
                  <button
                    onClick={() => setPhoto('')}
                    className="text-faint text-left text-[11px] underline"
                  >
                    {t('teacher.photo_remove')}
                  </button>
                )}
              </div>
            </div>

            <TeacherShowcaseFields value={showcase} onChange={setShowcase} />

            {/* О себе */}
            <Label>{t('admin.teachers.bio_label')}</Label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('teacher.bio_ph')}
              rows={4}
              maxLength={2000}
              className={cx(FIELD, 'resize-none')}
            />

            {/* Ссылки */}
            <Label>{t('teacher.website_label')}</Label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              type="url"
              className={FIELD}
            />

            <Label>Instagram</Label>
            <input
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/username"
              type="url"
              className={FIELD}
            />

            <Label>Telegram</Label>
            <input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="https://t.me/username"
              type="url"
              className={FIELD}
            />

            <div className="mt-5">
              <Button size="lg" onClick={handleSave} loading={update.isPending}>
                {t('teacher.save')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
