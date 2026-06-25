import { NextResponse } from 'next/server';
import { getServerToken } from '../../../../lib/server-token';
import { apiFetch } from '../../../../lib/api';

export async function GET(req: Request) {
  const token = await getServerToken();
  const { searchParams } = new URL(req.url);
  const res = await apiFetch(`/lessons/my?${searchParams.toString()}`, token);
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
