/**
 * Server-side helper — reads the JWT access token from the httpOnly cookie
 * that was set by POST /api/auth/twa.
 *
 * Use in Server Components and Route Handlers instead of next-auth getServerSession.
 */
import { cookies } from 'next/headers';

export async function getServerToken(): Promise<string> {
  const store = await cookies();
  return store.get('auth_token')?.value ?? '';
}
