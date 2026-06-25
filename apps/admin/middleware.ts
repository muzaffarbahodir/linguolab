/**
 * Next.js Middleware — защита роутов админки.
 *
 * Логика:
 * - Все роуты кроме /login и /api/auth/* требуют авторизации
 * - Неавторизованный → redirect /login
 * - Авторизованный на /login → redirect / (дашборд)
 *
 * NextAuth middleware проверяет JWT cookie (NEXTAUTH_SECRET).
 * Работает на Edge Runtime — не использует Node.js API.
 */

export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    /*
     * Защищаем все роуты кроме:
     * - /login (страница входа)
     * - /api/auth/* (NextAuth endpoints)
     * - /_next/* (Next.js статика)
     * - /favicon.ico, /robots.txt (статические файлы)
     */
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
};
