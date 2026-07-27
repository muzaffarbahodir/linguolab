import { useRef, useState } from 'react';
import { Check, Upload, X } from 'lucide-react';

import { apiClient } from '../api/client';
import { cx } from './ui';

export type DocumentKind = 'PASSPORT' | 'DIPLOMA' | 'CERTIFICATE' | 'CV' | 'PHOTO';

export interface UploadedDocument {
  kind: DocumentKind;
  key: string;
  url: string;
  filename: string;
}

/** 10 МБ — скан паспорта или диплома в это укладывается с запасом. */
const MAX_BYTES = 10 * 1024 * 1024;

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/**
 * Загрузка одного документа кандидата.
 *
 * Файл уходит в хранилище напрямую по presigned-ссылке, минуя наш сервер:
 * сканы паспортов и дипломов — не тот трафик, который стоит гонять через API.
 */
export function TeacherDocumentUpload({
  kind,
  label,
  required,
  value,
  onChange,
}: {
  kind: DocumentKind;
  label: string;
  required?: boolean;
  value?: UploadedDocument;
  onChange: (doc: UploadedDocument | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setError(null);

    if (file.size > MAX_BYTES) {
      setError('Файл больше 10 МБ');
      return;
    }

    setBusy(true);
    try {
      const { data } = await apiClient.post('/storage/presigned-upload', {
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });

      const put = await fetch(data.uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!put.ok) throw new Error('upload failed');

      onChange({ kind, key: data.key, url: data.publicUrl, filename: file.name });
    } catch {
      // Точную причину показывать бессмысленно — она всё равно про сеть или
      // хранилище, а человеку нужно только понять, что стоит повторить.
      setError('Не удалось загрузить. Попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="text-muted mb-1.5 block text-xs font-semibold">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>

      {value ? (
        <div className="border-ok/30 bg-ok/10 flex items-center gap-2 rounded-xl border px-3 py-2.5">
          <Check size={16} className="text-ok shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm">{value.filename}</span>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="press text-muted shrink-0"
            aria-label="Убрать файл"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={cx(
            'press flex w-full items-center justify-center gap-2 rounded-xl border border-dashed',
            'border-hairline bg-surface-2 text-muted px-3 py-3 text-sm font-medium',
            busy && 'opacity-60',
          )}
        >
          <Upload size={16} />
          {busy ? 'Загружаем…' : 'Выбрать файл'}
        </button>
      )}

      {error && <p className="text-danger mt-1 text-xs">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Сбрасываем значение: иначе повторный выбор того же файла после
          // ошибки не вызовет onChange.
          e.target.value = '';
          if (file) void pick(file);
        }}
      />
    </div>
  );
}
