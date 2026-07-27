import type { TeacherWorkFormat } from '@prisma/client';

/**
 * Виды документов кандидата в преподаватели.
 *
 * Список общий для приложения и админки: если он разъедется, кандидат будет
 * присылать одно, а менеджер ждать другое.
 */
export const DOCUMENT_KINDS = ['PASSPORT', 'DIPLOMA', 'CERTIFICATE', 'CV', 'PHOTO'] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface TeacherDocument {
  kind: DocumentKind;
  /** Ключ объекта в R2. */
  key: string;
  url: string;
  filename: string;
}

export const DOCUMENT_LABEL: Record<DocumentKind, string> = {
  PASSPORT: 'Паспорт или ID',
  DIPLOMA: 'Диплом об образовании',
  CERTIFICATE: 'Сертификаты',
  CV: 'Резюме',
  PHOTO: 'Фото для профиля',
};

/**
 * Что обязательно прислать файлом — зависит от формата работы.
 *
 * Онлайн-преподаватель в офис не приедет: всё, включая удостоверение личности,
 * он присылает цифрой. Очному паспорт проще показать при встрече, поэтому
 * заранее с него спрашиваем только то, без чего нельзя завести карточку и
 * проверить квалификацию.
 */
export const REQUIRED_DOCUMENTS: Record<TeacherWorkFormat, DocumentKind[]> = {
  ONLINE: ['PASSPORT', 'DIPLOMA', 'PHOTO'],
  OFFLINE: ['DIPLOMA', 'PHOTO'],
};

/** Что очный кандидат привозит в офис — показываем, чтобы он знал заранее. */
export const BRING_IN_PERSON: Record<TeacherWorkFormat, string[]> = {
  ONLINE: [],
  OFFLINE: ['Оригинал паспорта', 'Оригинал диплома'],
};

/**
 * Проверяет присланный список. Возвращает недостающие виды документов.
 *
 * Валидация здесь, а не в DTO: правило зависит от формата работы, и выразить
 * его декоратором на поле нельзя.
 */
export function missingDocuments(
  format: TeacherWorkFormat,
  documents: TeacherDocument[],
): DocumentKind[] {
  const present = new Set(documents.map((d) => d.kind));
  return REQUIRED_DOCUMENTS[format].filter((kind) => !present.has(kind));
}

/**
 * Отсекает мусор из присланного JSON: чужие поля, неизвестные виды документов
 * и записи без ключа. Клиент сюда кладёт результат загрузки в R2, и доверять
 * форме этих данных нельзя.
 */
export function sanitizeDocuments(raw: unknown, userId: string): TeacherDocument[] {
  if (!Array.isArray(raw)) return [];

  const out: TeacherDocument[] = [];
  for (const item of raw.slice(0, 20)) {
    if (!item || typeof item !== 'object') continue;
    const d = item as Record<string, unknown>;

    const kind = d.kind as DocumentKind;
    if (!DOCUMENT_KINDS.includes(kind)) continue;

    const key = typeof d.key === 'string' ? d.key : '';
    // Ключ обязан лежать в папке этого пользователя — иначе кандидат мог бы
    // приложить к своей заявке чужой загруженный файл.
    if (!key.startsWith(`uploads/${userId}/`)) continue;

    out.push({
      kind,
      key,
      url: typeof d.url === 'string' ? d.url : '',
      filename: typeof d.filename === 'string' ? d.filename.slice(0, 120) : '',
    });
  }
  return out;
}
