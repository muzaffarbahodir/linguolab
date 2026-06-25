import { NextResponse } from 'next/server';
import { getServerToken } from '../../../../../../../lib/server-token';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

/**
 * GET /api/proxy/teacher/classes/[id]/homework
 * → GET /api/v1/homework/class/:id  (list)
 *   + GET /api/v1/homework/:hwId/submissions for each (to include submissions)
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getServerToken();

  const listRes = await fetch(`${API_URL}/api/v1/homework/class/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) {
    const data: unknown = await listRes.json();
    return NextResponse.json(data, { status: listRes.status });
  }

  const homeworks = (await listRes.json()) as Array<{
    id: string;
    title: string;
    description: string | null;
    due_date: string | null;
  }>;

  // Fetch submissions for each homework in parallel
  const results = await Promise.all(
    homeworks.map(async (hw) => {
      const subRes = await fetch(`${API_URL}/api/v1/homework/${hw.id}/submissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const submissions = subRes.ok ? ((await subRes.json()) as unknown[]) : [];
      return { ...hw, submissions };
    }),
  );

  return NextResponse.json(results);
}

/** POST /api/proxy/teacher/classes/[id]/homework → POST /api/v1/homework */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getServerToken();
  const body = (await req.json()) as Record<string, unknown>;

  const res = await fetch(`${API_URL}/api/v1/homework`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, class_id: id }),
  });
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
