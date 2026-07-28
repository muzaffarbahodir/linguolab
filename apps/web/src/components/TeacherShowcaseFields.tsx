import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import WebApp from '@twa-dev/sdk';
import { Plus, Trash2, Video } from 'lucide-react';

import { MAX_VIDEO_BYTES, uploadVideo } from '../api/uploads';
import type { ShowcaseDraft } from './teacher-showcase-draft';
import { toast } from '../store/toast';
import { Button, cx } from './ui';

const FIELD =
  'bg-surface-2 border-hairline w-full rounded-2xl border px-4 py-2.5 text-sm text-[color:var(--text)] outline-none';

function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-muted mb-1 mt-3 block text-xs font-medium">{children}</label>;
}

/**
 * Поля витрины преподавателя.
 *
 * Одни и те же в двух местах: преподаватель заполняет их о себе, а менеджер —
 * за тех, кого завели через админку и кто в Telegram не заходит вовсе. Форма
 * общая, чтобы наборы полей не разъехались между этими двумя экранами.
 */
export function TeacherShowcaseFields({
  value,
  onChange,
}: {
  value: ShowcaseDraft;
  onChange: (next: ShowcaseDraft) => void;
}) {
  const { t } = useTranslation();
  const [videoUploading, setVideoUploading] = useState(false);

  const patch = (part: Partial<ShowcaseDraft>) => onChange({ ...value, ...part });

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
      patch({ intro_video_url: await uploadVideo(file) });
      WebApp.HapticFeedback.notificationOccurred('success');
    } catch {
      toast.error(t('teacher.video_failed'));
    } finally {
      setVideoUploading(false);
    }
  }

  return (
    <>
      {/* Видео-визитка */}
      <Label>{t('teacher.video_label')}</Label>
      <p className="text-faint mb-2 text-[11px] leading-snug">{t('teacher.video_hint')}</p>
      {value.intro_video_url ? (
        <div className="border-hairline bg-surface-2 flex items-center gap-2 rounded-2xl border px-3 py-2.5">
          <Video size={16} className="text-ok shrink-0" />
          <span className="text-muted min-w-0 flex-1 truncate text-xs">
            {t('teacher.video_label')}
          </span>
          <button
            type="button"
            onClick={() => patch({ intro_video_url: '' })}
            className="press text-danger shrink-0"
            aria-label={t('teacher.video_remove')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <label
          className={cx(
            'press border-hairline bg-surface-2 text-muted flex w-full cursor-pointer',
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
        value={value.headline}
        onChange={(e) => patch({ headline: e.target.value })}
        placeholder={t('teacher.headline_ph')}
        maxLength={120}
        className={FIELD}
      />

      {/* Страна и опыт */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Label>{t('teacher.country_label')}</Label>
          <input
            value={value.country}
            onChange={(e) => patch({ country: e.target.value })}
            placeholder={t('teacher.country_ph')}
            maxLength={60}
            className={FIELD}
          />
        </div>
        <div className="w-28">
          <Label>{t('teacher.experience_label')}</Label>
          <input
            value={value.experience}
            onChange={(e) => patch({ experience: e.target.value.replace(/\D/g, '').slice(0, 2) })}
            inputMode="numeric"
            placeholder="5"
            className={FIELD}
          />
        </div>
      </div>

      {/* Направления */}
      <Label>{t('teacher.specializations_label')}</Label>
      <input
        value={value.specializations}
        onChange={(e) => patch({ specializations: e.target.value })}
        placeholder={t('teacher.specializations_ph')}
        className={FIELD}
      />

      {/* Языки владения */}
      <Label>{t('teacher.speaks_label')}</Label>
      <div className="space-y-2">
        {value.speaks.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={s.name}
              onChange={(e) =>
                patch({
                  speaks: value.speaks.map((x, j) =>
                    j === i ? { ...x, name: e.target.value } : x,
                  ),
                })
              }
              placeholder={t('teacher.speaks_ph_name')}
              maxLength={60}
              className={cx(FIELD, 'flex-1')}
            />
            <input
              value={s.level}
              onChange={(e) =>
                patch({
                  speaks: value.speaks.map((x, j) =>
                    j === i ? { ...x, level: e.target.value } : x,
                  ),
                })
              }
              placeholder={t('teacher.speaks_ph_level')}
              maxLength={30}
              className={cx(FIELD, 'w-24')}
            />
            <button
              type="button"
              onClick={() => patch({ speaks: value.speaks.filter((_, j) => j !== i) })}
              className="press text-faint shrink-0 px-1"
              aria-label="—"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {value.speaks.length < 10 && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => patch({ speaks: [...value.speaks, { name: '', level: '' }] })}
          >
            {t('teacher.speaks_add')}
          </Button>
        )}
      </div>
    </>
  );
}
