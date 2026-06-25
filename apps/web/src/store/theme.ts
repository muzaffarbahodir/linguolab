/**
 * Theme store — элегантная тёмная (default) ⇄ светлая.
 * Переключает класс html.light (CSS-переменные в index.css), синхронит
 * Telegram tg-vars + цвет шапки/фона, сохраняет выбор в localStorage.
 */
import { create } from 'zustand';
import WebApp from '@twa-dev/sdk';

export type Theme = 'dark' | 'light';

const KEY = 'll_theme';

// Telegram tg-theme vars per theme — чтобы нативная шапка/фон совпадали с UI.
const TG_VARS: Record<Theme, Record<string, string>> = {
  dark: {
    '--tg-theme-bg-color': '#0e141e',
    '--tg-theme-secondary-bg-color': '#1a2433',
    '--tg-theme-text-color': '#eef1f6',
    '--tg-theme-hint-color': '#8b95a5',
    '--tg-theme-header-bg-color': '#0e141e',
  },
  light: {
    '--tg-theme-bg-color': '#f3f5fa',
    '--tg-theme-secondary-bg-color': '#ffffff',
    '--tg-theme-text-color': '#1a2233',
    '--tg-theme-hint-color': '#5a6678',
    '--tg-theme-header-bg-color': '#f3f5fa',
  },
};

const CHROME: Record<Theme, `#${string}`> = { dark: '#0e141e', light: '#f3f5fa' };

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  for (const [k, v] of Object.entries(TG_VARS[theme])) root.style.setProperty(k, v);
  try {
    WebApp.setHeaderColor(CHROME[theme]);
    WebApp.setBackgroundColor(CHROME[theme]);
  } catch {
    // старый клиент Telegram без методов — не критично
  }
}

function initialTheme(): Theme {
  try {
    const s = localStorage.getItem(KEY);
    if (s === 'light' || s === 'dark') return s;
  } catch {
    /* localStorage недоступен */
  }
  return 'dark';
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme(),
  setTheme: (t) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
    applyTheme(t);
    set({ theme: t });
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));
