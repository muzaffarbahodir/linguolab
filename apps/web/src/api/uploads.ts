import { apiClient } from './client';

interface PresignedUploadResponse {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Загружает картинку в Cloudflare R2 через presigned PUT и возвращает public URL.
 * Бэк ограничивает типы (jpeg/png/webp) и размер (≤50 МБ).
 */
export async function uploadImage(file: File): Promise<string> {
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) throw new Error('Только PNG, JPEG или WEBP');
  if (file.size > 50 * 1024 * 1024) throw new Error('Файл больше 50 МБ');

  // Имя должно подходить под бэк-валидацию: ^[\w.-]+$
  const safeName = `img_${Date.now()}.${ext}`;

  const presign = await apiClient.post<PresignedUploadResponse>('/storage/presigned-upload', {
    filename: safeName,
    contentType: file.type,
    size: file.size,
  });

  const { uploadUrl, publicUrl } = presign.data;

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!res.ok) throw new Error('Не удалось загрузить файл');

  return publicUrl;
}

const VIDEO_EXT_BY_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

/** Порог тот же, что на бэке — чтобы не отправлять заведомо отказной запрос. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/**
 * Загружает видео-визитку преподавателя тем же путём, что и картинки.
 *
 * quicktime здесь обязателен: айфон снимает .mov, и без него добрая половина
 * преподавателей упёрлась бы в отказ на первом же файле.
 */
export async function uploadVideo(file: File): Promise<string> {
  const ext = VIDEO_EXT_BY_TYPE[file.type];
  if (!ext) throw new Error('Только MP4, WEBM или MOV');
  if (file.size > MAX_VIDEO_BYTES) throw new Error('Файл больше 50 МБ');

  const safeName = `intro_${Date.now()}.${ext}`;

  const presign = await apiClient.post<PresignedUploadResponse>('/storage/presigned-upload', {
    filename: safeName,
    contentType: file.type,
    size: file.size,
  });

  const { uploadUrl, publicUrl } = presign.data;

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!res.ok) throw new Error('Не удалось загрузить файл');

  return publicUrl;
}
