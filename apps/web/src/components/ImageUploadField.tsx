/**
 * ImageUploadField — загрузка картинки в Cloudflare R2 + ручной URL.
 * Превью, кнопка «Загрузить фото», очистка. value = public URL.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { uploadImage } from '../api/uploads';

export function ImageUploadField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // позволяем повторно выбрать тот же файл
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('upload.error'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        {/* Превью */}
        <div className="bg-surface-2 relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="text-faint flex h-full w-full items-center justify-center text-2xl">
              🖼
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="border-t-brand h-5 w-5 animate-spin rounded-full border-2 border-white/40" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            className="glass-option press rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
          >
            {uploading ? t('upload.uploading') : t('upload.pick')}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-faint press text-xs underline"
            >
              {t('upload.remove')}
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {error && <p className="text-danger mt-1 text-xs">{error}</p>}

      {/* Ручной URL — запасной вариант */}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-2"
        placeholder="https://..."
        inputMode="url"
      />
    </div>
  );
}
