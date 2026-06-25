/**
 * Middleware — lightweight auth check for TWA portal.
 *
 * The auth_token cookie is set by POST /api/auth/twa (AuthProvider on client mount).
 * Protected routes redirect to / if no cookie — AuthProvider will re-init TWA auth there.
 *
 * / (root) is always accessible so AuthProvider can run and set the cookie.
 */
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/api/auth', '/_next', '/favicon.ico', '/robots.txt'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth_token')?.value;

  if (!token) {
    // Redirect to root where AuthProvider will init
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
