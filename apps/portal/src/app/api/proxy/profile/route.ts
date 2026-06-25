import { NextResponse } from 'next/server';
import { getServerToken } from '../../../../lib/server-token';
import { apiFetch } from '../../../../lib/api';

export async function GET() {
  const token = await getServerToken();
  const res = await apiFetch('/users/me', token);
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(req: Request) {
  const token = await getServerToken();
  const body: unknown = await req.json();
  const res = await apiFetch('/users/me', token, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
