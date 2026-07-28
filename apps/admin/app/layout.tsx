import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Manrope — тот же пакет, что в мини-приложении, а не next/font/google.
// next/font скачивает файлы из сети во время сборки, и недоступность Google
// Fonts ломала бы деплой; здесь шрифт лежит в зависимостях.
import '@fontsource-variable/manrope';
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
