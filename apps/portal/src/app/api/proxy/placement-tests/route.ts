import { NextResponse } from 'next/server';
import { getServerToken } from '../../../../lib/server-token';
import { apiFetch } from '../../../../lib/api';

// POST /api/proxy/placement-tests/start?lang=en
// POST /api/proxy/placement-tests/answer
// POST /api/proxy/placement-tests/complete
export async function POST(req: Request) {
  const token = await getServerToken();
  const { searchParams, pathname } = new URL(req.url);

  const action = pathname.split('/').pop(); // start | answer | complete
  const body: unknown = action !== 'start' ? await req.json() : undefined;

  let apiPath = '/placement-tests';
  if (action === 'start') {
    const lang = searchParams.get('lang') ?? 'en';
    apiPath = `/placement-tests/start/${lang}`;
  } else if (action === 'answer') {
    apiPath = '/placement-tests/answer';
  } else if (action === 'complete') {
    apiPath = '/placement-tests/complete';
  }

  const res = await apiFetch(apiPath, token, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: unknown = await res.json();
  return NextResponse.json(data, { status: res.status });
}
