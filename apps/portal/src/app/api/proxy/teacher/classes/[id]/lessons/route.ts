import { NextResponse } from 'next/server';
import { getServerToken } from '../../../../../../../lib/server-token';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

/** GET /api/proxy/teacher/classes/[id]/lessons → GET /api/v1/lessons/class/:id */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getServerToken();

  const res = await fetch(`${API_URL}/api/v1/lessons/class/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}

/** POST /api/proxy/teacher/classes/[id]/lessons → POST /api/v1/lessons */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getServerToken();
  const body = (await req.json()) as Record<string, unknown>;

  const res = await fetch(`${API_URL}/api/v1/lessons`, {
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
