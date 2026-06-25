import { NextResponse } from 'next/server';
import { getServerToken } from '../../../../../lib/server-token';
import { apiFetch } from '../../../../../lib/api';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getServerToken();
  const res = await apiFetch(`/classes/${id}`, token);
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
