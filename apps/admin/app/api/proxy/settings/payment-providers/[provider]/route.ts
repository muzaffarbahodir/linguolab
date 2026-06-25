import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '../../../../../../lib/auth';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

export async function PATCH(request: NextRequest, { params }: { params: { provider: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    is_enabled?: boolean;
    display_order?: number;
    config?: Record<string, unknown>;
  };

  const res = await fetch(`${API_URL}/api/v1/admin/settings/payment-providers/${params.provider}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as unknown;
  return NextResponse.json(data, { status: res.status });
}
