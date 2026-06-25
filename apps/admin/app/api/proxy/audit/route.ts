import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '../../../../lib/auth';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const qs = searchParams.toString();

  const res = await fetch(`${API_URL}/api/v1/admin/audit${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });

  const data = (await res.json()) as unknown;
  return NextResponse.json(data, { status: res.status });
}
