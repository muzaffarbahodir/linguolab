import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { Providers } from './providers';
import { TwaGuard } from '../components/TwaGuard';
import BottomNav from '../components/BottomNav';

export const metadata: Metadata = {
  title: 'LinguoLab — Личный кабинет',
  description: 'Личный кабинет студента языкового центра LinguoLab',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen antialiased" style={{ color: 'var(--glass-text)' }}>
        <Providers>
          <TwaGuard>
            {/* pb-28 — space for fixed BottomNav */}
            <div className="pb-28">{children}</div>
            <BottomNav />
          </TwaGuard>
        </Providers>
      </body>
    </html>
  );
}
