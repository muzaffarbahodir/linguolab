/**
 * NextAuth routes are no longer used.
 * Authentication is handled via Telegram WebApp initData at /api/auth/twa.
 */
import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ error: 'Use /api/auth/twa for TWA authentication' }, { status: 410 });
}

export function POST() {
  return NextResponse.json({ error: 'Use /api/auth/twa for TWA authentication' }, { status: 410 });
}
