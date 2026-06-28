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

// localStorage — durable между перезагрузками TWA (как тема). sessionStorage
// раньше сбрасывался при reload и язык «слетал». Обёртки — TWA может бросать.
function readLocal(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeLocal(v: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* TWA блокирует localStorage — полагаемся на CloudStorage */
  }
}

// ─── module-level locale (singleton) ─────────────────────────────────────────

/** Текущий locale — инициализируется один раз при загрузке модуля */
let _locale = 'ru';

function resolveInitial(): string {
  const cached = readLocal();
  if (cached && LANGUAGES.some((l) => l.code === cached)) return cached;
  // Fallback: язык Telegram
  const tgLang = WebApp.initDataUnsafe?.user?.language_code ?? 'ru';
  return LANGUAGES.some((l) => l.code === tgLang) ? tgLang : 'ru';
}

_locale = resolveInitial();
document.documentElement.lang = _locale;

if (i18n.language !== _locale) {
  void i18n.changeLanguage(_locale);
}

// CloudStorage (кросс-девайс) применяем ТОЛЬКО если локального выбора ещё нет —
// иначе асинхронный ответ мог перетереть только что выбранный язык (язык «менялся»).
const hadLocal = !!readLocal();
WebApp.CloudStorage.getItem(STORAGE_KEY, (err, value) => {
  if (err || !value || hadLocal || value === _locale) return;
  if (!LANGUAGES.some((l) => l.code === value)) return;
  _locale = value;
  writeLocal(value);
  document.documentElement.lang = value;
  void i18n.changeLanguage(value);
  window.dispatchEvent(new Event(EVENT));
});

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Сохраняет locale в CloudStorage + sessionStorage + обновляет document.lang.
 * Вызывает i18n.changeLanguage() → react-i18next перерисует все компоненты.
 */
export function applyLocale(code: string): void {
  _locale = code;
  writeLocal(code);
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
