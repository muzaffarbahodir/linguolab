import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MyHomework {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  created_at: string;
  class: {
    title: string;
    language: { flag_emoji: string; name_ru: string };
  };
  my_submission: {
    status: 'SUBMITTED' | 'GRADED' | 'LATE';
    grade: number | null;
    feedback: string | null;
  } | null;
}

export interface SubmitHomeworkPayload {
  file_key?: string;
  file_url?: string;
  text_answer?: string;
}

export interface PresignedUploadResponse {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchMyHomework(): Promise<MyHomework[]> {
  const res = await apiClient.get<MyHomework[]>('/homework/my');
  return res.data;
}

async function getPresignedUpload(
  filename: string,
  contentType: string,
  size: number,
): Promise<PresignedUploadResponse> {
  const res = await apiClient.post<PresignedUploadResponse>('/storage/presigned-upload', {
    filename,
    contentType,
    size,
  });
  return res.data;
}

async function uploadFileToR2(uploadUrl: string, file: File): Promise<void> {
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
}

async function submitHomework(homeworkId: string, payload: SubmitHomeworkPayload) {
  const res = await apiClient.post(`/homework/${homeworkId}/submit`, payload);
  return res.data;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useMyHomework() {
  return useQuery({
    queryKey: ['homework', 'my'],
    queryFn: fetchMyHomework,
  });
}

export function useSubmitHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      homeworkId,
      file,
      textAnswer,
    }: {
      homeworkId: string;
      file?: File;
      textAnswer?: string;
    }) => {
      let file_key: string | undefined;
      let file_url: string | undefined;

      if (file) {
        const { key, uploadUrl, publicUrl } = await getPresignedUpload(
          file.name,
          file.type,
          file.size,
        );
        await uploadFileToR2(uploadUrl, file);
        file_key = key;
        file_url = publicUrl;
      }

      return submitHomework(homeworkId, { file_key, file_url, text_answer: textAnswer });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['homework', 'my'] });
    },
  });
}
