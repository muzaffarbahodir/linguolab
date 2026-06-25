'use client';

/**
 * Providers — клиентские провайдеры для Admin App Router.
 *
 * SessionProvider нужен для использования useSession() в Client Components.
 * Оборачиваем в отдельный файл чтобы layout.tsx остался Server Component.
 */

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
