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
    '--tg-theme-bg-color': '#09090b',
    '--tg-theme-secondary-bg-color': '#18181b',
    '--tg-theme-text-color': '#fafafa',
    '--tg-theme-hint-color': '#71717a',
    '--tg-theme-header-bg-color': '#09090b',
  },
  light: {
    '--tg-theme-bg-color': '#f4f1e9',
    '--tg-theme-secondary-bg-color': '#fcfbf7',
    '--tg-theme-text-color': '#1c1a17',
    '--tg-theme-hint-color': '#6b6760',
    '--tg-theme-header-bg-color': '#f4f1e9',
  },
};

const CHROME: Record<Theme, `#${string}`> = { dark: '#09090b', light: '#f4f1e9' };

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
