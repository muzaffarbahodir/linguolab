import { NextResponse } from 'next/server';
import { getServerToken } from '../../../../../../lib/server-token';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

/**
 * PATCH /api/proxy/teacher/homework/[id]
 * → PATCH /api/v1/homework/submissions/:submissionId/grade
 * Body: { grade: number, feedback?: string }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getServerToken();
  const body = (await req.json()) as Record<string, unknown>;

  const res = await fetch(`${API_URL}/api/v1/homework/submissions/${id}/grade`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
