/**
 * POST /api/auth/twa
 *
 * Receives Telegram WebApp.initData, validates it against the backend,
 * then sets an httpOnly auth_token cookie and returns the user object.
 *
 * Called exclusively by AuthProvider on the client side.
 */
import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    first_name: string;
    last_name: string | null;
    username: string | null;
    avatar_url: string | null;
    role: string;
    is_active: boolean;
    locale: string;
    timezone: string;
  };
}

export async function POST(req: NextRequest) {
  let initData: string;
  try {
    const body = (await req.json()) as { initData?: string };
    initData = body.initData ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!initData) {
    return NextResponse.json({ error: 'initData is required' }, { status: 400 });
  }

  // Proxy to backend
  const backendRes = await fetch(`${API_URL}/api/v1/auth/telegram/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData }),
  });

  if (!backendRes.ok) {
    const err: unknown = await backendRes.json().catch(() => ({ error: 'Backend error' }));
    return NextResponse.json(err, { status: backendRes.status });
  }

  const data = (await backendRes.json()) as AuthResponse;

  const response = NextResponse.json({ user: data.user });

  const isProd = process.env.NODE_ENV === 'production';

  // Access token — 15 min (matches JWT_ACCESS_TTL on backend)
  response.cookies.set('auth_token', data.access_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 60 * 60, // 1 hour (slightly longer than JWT for UX)
    path: '/',
  });

  // Refresh token — 30 days
  response.cookies.set('refresh_token', data.refresh_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  return response;
}
