/**
 * Proxy для всех analytics endpoints.
 * GET /api/proxy/analytics?type=revenue|students|enrollments&months=12
 *
 * Один route вместо трёх — проще поддерживать.
 */
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
  const type = searchParams.get('type') ?? 'revenue';
  const months = searchParams.get('months') ?? '12';

  const endpointMap: Record<string, string> = {
    revenue: `/api/v1/admin/analytics/revenue?months=${months}`,
    students: `/api/v1/admin/analytics/students?months=${months}`,
    enrollments: `/api/v1/admin/analytics/enrollments`,
  };

  const endpoint = endpointMap[type];
  if (!endpoint) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  const data = (await res.json()) as unknown;
  return NextResponse.json(data, { status: res.status });
}
