import { NextResponse } from 'next/server';
import { getServerToken } from '../../../../lib/server-token';
import { apiFetch } from '../../../../lib/api';

export async function GET() {
  const token = await getServerToken();
  const res = await apiFetch('/payments/my', token);
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
