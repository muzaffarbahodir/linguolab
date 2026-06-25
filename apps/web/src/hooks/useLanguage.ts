import { useEffect, useState } from 'react';
import WebApp from '@twa-dev/sdk';

import i18n from '../lib/i18n';

// ─── types ────────────────────────────────────────────────────────────────────

export interface LangOption {
  code: string;
  label: string;
  flag: string;
}

export const LANGUAGES: LangOption[] = [
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'uz', label: "O'zbek", flag: '🇺🇿' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

const STORAGE_KEY = 'user_language';
const EVENT = 'linguolab:locale-change';

// ─── module-level locale (singleton) ─────────────────────────────────────────

/** Текущий locale — инициализируется один раз при загрузке модуля */
let _locale = 'ru';

function resolveInitial(): string {
  // CloudStorage недоступен синхронно — читаем из sessionStorage как кеш
  const cached = sessionStorage.getItem(STORAGE_KEY);
  if (cached) return cached;
  // Fallback: язык Telegram
  const tgLang = WebApp.initDataUnsafe?.user?.language_code ?? 'ru';
  return LANGUAGES.some((l) => l.code === tgLang) ? tgLang : 'ru';
}

_locale = resolveInitial();
document.documentElement.lang = _locale;

// Синхронизируем i18next с resolved locale.
// i18n.ts инициализируется с fallback 'ru', но useLanguage может
// определить другой язык из Telegram. Синхронизируем сразу.
if (i18n.language !== _locale) {
  void i18n.changeLanguage(_locale);
}

// При старте читаем из CloudStorage (асинхронно) и обновляем если отличается
WebApp.CloudStorage.getItem(STORAGE_KEY, (err, value) => {
  if (!err && value && value !== _locale) {
    _locale = value;
    sessionStorage.setItem(STORAGE_KEY, value);
    document.documentElement.lang = value;
    // Синхронизируем i18next при восстановлении из CloudStorage
    void i18n.changeLanguage(value);
    window.dispatchEvent(new Event(EVENT));
  }
});

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Сохраняет locale в CloudStorage + sessionStorage + обновляет document.lang.
 * Вызывает i18n.changeLanguage() → react-i18next перерисует все компоненты.
 */
export function applyLocale(code: string): void {
  _locale = code;
  sessionStorage.setItem(STORAGE_KEY, code);
  document.documentElement.lang = code;
  WebApp.CloudStorage.setItem(STORAGE_KEY, code);
  void i18n.changeLanguage(code);
  window.dispatchEvent(new Event(EVENT));
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useLanguage() {
  const [locale, setLocale] = useState(_locale);

  useEffect(() => {
    const handler = () => setLocale(_locale);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0]!;

  return { locale, current, setLocale: applyLocale };
}
