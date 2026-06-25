import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const API_URL = process.env.API_URL ?? 'http://linguolab_api:3000';

/**
 * authOptions — единая конфигурация NextAuth.
 * Экспортируем чтобы передавать в getServerSession(authOptions) везде.
 * В App Router getServerSession() без authOptions возвращает null.
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        try {
          const res = await fetch(`${API_URL}/api/v1/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = (await res.json()) as {
            access_token: string;
            user: {
              id: string;
              first_name: string;
              last_name: string | null;
              role: string;
            };
          };

          return {
            id: data.user.id,
            name: `${data.user.first_name} ${data.user.last_name ?? ''}`.trim(),
            email: credentials.email,
            role: data.user.role,
            accessToken: data.access_token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as { role: string; accessToken: string };
        token.role = u.role;
        token.accessToken = u.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      (session as { accessToken?: string }).accessToken = token.accessToken as string;
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
