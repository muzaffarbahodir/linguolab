import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WebApp from '@twa-dev/sdk';

// Sentry — инициализируем до рендера (отключён если нет VITE_SENTRY_DSN)
// Replay-интеграцию НЕ подключаем: тяжёлая (~100 КБ) для TWA на мобильной сети.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  environment: import.meta.env.MODE,
  integrations: [Sentry.browserTracingIntegration()],
  ignoreErrors: ['Non-Error promise rejection captured'],
});

import { I18nextProvider } from 'react-i18next';

import App from './App';
import './styles/index.css';
import i18n from './lib/i18n'; // инициализация i18next до рендера (initImmediate: false)
import { useAuthStore } from './store/auth';
import { useThemeStore, applyTheme } from './store/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Telegram WebApp инициализация
// ─────────────────────────────────────────────────────────────────────────────

WebApp.ready();
WebApp.expand();
if (typeof WebApp.disableVerticalSwipes === 'function') {
  WebApp.disableVerticalSwipes();
}

// ─────────────────────────────────────────────────────────────────────────────
// Тема приложения — элегантная тёмная (default) ⇄ светлая, выбор юзера.
//
// Не зависим от темы Telegram-клиента: класс html.light + CSS-переменные
// (index.css) — единый источник. Telegram может пере-инжектить tg-vars при
// смене своей темы → на событии переприменяем НАШУ тему. Постоянный link/
// button/destructive задаём один раз. Подробности: store/theme.ts
// ─────────────────────────────────────────────────────────────────────────────

const STATIC_TG_VARS: Record<string, string> = {
  '--tg-theme-link-color': '#8b5cf6',
  '--tg-theme-button-color': '#6c5ce7',
  '--tg-theme-button-text-color': '#ffffff',
  '--tg-theme-destructive-text-color': '#ff453a',
  '--tg-theme-accent-text-color': '#8b5cf6',
};
for (const [k, v] of Object.entries(STATIC_TG_VARS)) {
  document.documentElement.style.setProperty(k, v);
}

applyTheme(useThemeStore.getState().theme);
// Telegram может пере-инжектить vars при смене своей темы — переприменяем нашу.
WebApp.onEvent('themeChanged', () => applyTheme(useThemeStore.getState().theme));

// ─────────────────────────────────────────────────────────────────────────────
// Auto-init авторизации при старте приложения
//
// WebApp.initData — строка от Telegram, всегда доступна внутри WebView.
// При запуске вне Telegram (браузер) → initData пустой → показываем NotInTelegram.
// ─────────────────────────────────────────────────────────────────────────────

const initData = WebApp.initData;

if (!initData) {
  // Запущено вне Telegram — помечаем состояние
  useAuthStore.getState().setNotInTelegram();
} else {
  // Запускаем авторизацию асинхронно (не блокируем рендер)
  // App.tsx читает status из store и показывает LoadingScreen пока идёт auth
  useAuthStore
    .getState()
    .login(initData)
    .catch(() => {
      // Ошибка авторизации — status уже 'error' в store, App.tsx покажет fallback
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// React Query клиент
// staleTime 30s — для TWA: пользователь часто переоткрывает
// refetchOnWindowFocus false — окно Telegram ≠ browser tab focus
// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// TWA переоткрыли (свернули/развернули) → обновляем данные. refetchOnWindowFocus
// не ловит TWA, а visibilitychange — да. Рефетчим только устаревшие активные запросы.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void queryClient.invalidateQueries({ refetchType: 'active' });
  }
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found in index.html');
}

function AppCrash() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#1a1e27',
        color: 'rgba(255,255,255,0.7)',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 32 }}>⚠️</span>
      <p style={{ fontSize: 14, margin: 0 }}>{i18n.t('app.crash_title')}</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 8,
          padding: '8px 20px',
          borderRadius: 12,
          background: '#6C5CE7',
          color: '#fff',
          border: 'none',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {i18n.t('app.crash_action')}
      </button>
    </div>
  );
}

createRoot(rootEl).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppCrash />}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </I18nextProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
