import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'LinguoLab Admin',
  description: 'Админ-панель языкового центра LinguoLab',
};

/**
 * Корневой layout Next.js App Router.
 * Оборачиваем в Providers для SessionProvider (NextAuth).
 * lang="ru" — основной язык интерфейса.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-gray-50 text-gray-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
