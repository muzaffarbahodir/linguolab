import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Plus, Trash2, Video } from 'lucide-react';

import { useTeacherProfileByUserId, useUpdateTeacherProfile } from '../../api/teachers';
import type { SpokenLanguage } from '../../api/teachers';
import { MAX_VIDEO_BYTES, uploadImage, uploadVideo } from '../../api/uploads';
import { toast } from '../../store/toast';
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
 * Черт (highlights) здесь намеренно нет — их ставит менеджер. Оценку «терпеливый»
 * человек не выдаёт себе сам, иначе она ничего не стоит.
 */
export function EditProfileSheet({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: profile } = useTeacherProfileByUserId(userId);
  const update = useUpdateTeacherProfile();

  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState('');
  const [uploading, setUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [video, setVideo] = useState('');
  const [headline, setHeadline] = useState('');
  const [country, setCountry] = useState('');
  const [experience, setExperience] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [speaks, setSpeaks] = useState<SpokenLanguage[]>([]);
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');
  const [done, setDone] = useState(false);

  // Профиль может прийти уже после монтирования — подхватываем значения.
  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? '');
    setPhoto(profile.photo_url ?? '');
    setVideo(profile.intro_video_url ?? '');
    setHeadline(profile.headline ?? '');
    setCountry(profile.country ?? '');
    setExperience(profile.experience_years !== null ? String(profile.experience_years) : '');
    setSpecializations(profile.specializations.join(', '));
    setSpeaks(profile.speaks);
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

  async function handleVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Проверяем до запроса: presign всё равно откажет, но человек к тому
    // моменту уже потратит время на ожидание.
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(t('teacher.video_too_big'));
      return;
    }
    setVideoUploading(true);
    try {
      setVideo(await uploadVideo(file));
      WebApp.HapticFeedback.notificationOccurred('success');
    } catch {
      toast.error(t('teacher.video_failed'));
    } finally {
      setVideoUploading(false);
    }
  }

  function handleSave() {
    const years = parseInt(experience, 10);

    update.mutate(
      {
        bio: bio.trim() || undefined,
        photo_url: photo.trim() ? photo.trim() : null,
        // Пустая строка — это «убрать видео», поэтому null, а не undefined:
        // undefined бэк пропустит мимо и старая ссылка останется.
        intro_video_url: video.trim() ? video.trim() : null,
        headline: headline.trim() || undefined,
        country: country.trim() || undefined,
        experience_years: Number.isFinite(years) && years >= 0 ? years : undefined,
        specializations: specializations
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 8),
        speaks: speaks.filter((s) => s.name.trim()),
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

            {/* Видео-визитка */}
            <Label>{t('teacher.video_label')}</Label>
            <p className="text-faint mb-2 text-[11px] leading-snug">{t('teacher.video_hint')}</p>
            {video ? (
              <div className="border-hairline bg-surface-2 mb-1 flex items-center gap-2 rounded-2xl border px-3 py-2.5">
                <Video size={16} className="text-ok shrink-0" />
                <span className="text-muted min-w-0 flex-1 truncate text-xs">
                  {t('teacher.video_label')}
                </span>
                <button
                  type="button"
                  onClick={() => setVideo('')}
                  className="press text-danger shrink-0"
                  aria-label={t('teacher.video_remove')}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : (
              <label
                className={cx(
                  'press border-hairline bg-surface-2 text-muted mb-1 flex w-full cursor-pointer',
                  'items-center justify-center gap-2 rounded-2xl border border-dashed px-3 py-3 text-sm font-medium',
                  videoUploading && 'opacity-60',
                )}
              >
                <Video size={16} />
                {videoUploading ? t('teacher.video_uploading') : t('teacher.video_upload')}
                <input
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => void handleVideoPick(e)}
                  disabled={videoUploading}
                  className="hidden"
                />
              </label>
            )}

            {/* Специализация */}
            <Label>{t('teacher.headline_label')}</Label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={t('teacher.headline_ph')}
              maxLength={120}
              className={FIELD}
            />

            {/* Страна и опыт */}
            <div className="flex gap-3">
              <div className="flex-1">
                <Label>{t('teacher.country_label')}</Label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder={t('teacher.country_ph')}
                  maxLength={60}
                  className={FIELD}
                />
              </div>
              <div className="w-28">
                <Label>{t('teacher.experience_label')}</Label>
                <input
                  value={experience}
                  onChange={(e) => setExperience(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  inputMode="numeric"
                  placeholder="5"
                  className={FIELD}
                />
              </div>
            </div>

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

            {/* Направления */}
            <Label>{t('teacher.specializations_label')}</Label>
            <input
              value={specializations}
              onChange={(e) => setSpecializations(e.target.value)}
              placeholder={t('teacher.specializations_ph')}
              className={FIELD}
            />

            {/* Языки владения */}
            <Label>{t('teacher.speaks_label')}</Label>
            <div className="space-y-2">
              {speaks.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={s.name}
                    onChange={(e) =>
                      setSpeaks((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                      )
                    }
                    placeholder={t('teacher.speaks_ph_name')}
                    maxLength={60}
                    className={cx(FIELD, 'flex-1')}
                  />
                  <input
                    value={s.level}
                    onChange={(e) =>
                      setSpeaks((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, level: e.target.value } : x)),
                      )
                    }
                    placeholder={t('teacher.speaks_ph_level')}
                    maxLength={30}
                    className={cx(FIELD, 'w-24')}
                  />
                  <button
                    type="button"
                    onClick={() => setSpeaks((prev) => prev.filter((_, j) => j !== i))}
                    className="press text-faint shrink-0 px-1"
                    aria-label="—"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {speaks.length < 10 && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Plus size={14} />}
                  onClick={() => setSpeaks((prev) => [...prev, { name: '', level: '' }])}
                >
                  {t('teacher.speaks_add')}
                </Button>
              )}
            </div>

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
