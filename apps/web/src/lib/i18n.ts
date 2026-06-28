/**
 * i18n.ts — конфигурация i18next для LinguoLab.
 *
 * Используем inline resources (JSON импортируется через Vite) вместо
 * http-backend, чтобы переводы были доступны мгновенно без async-загрузки.
 *
 * Файлы также лежат в public/locales/ для будущего http-backend если понадобится.
 *
 * Смена языка: useLanguage.ts вызывает i18n.changeLanguage() при applyLocale()
 * → react-i18next автоматически перерисовывает компоненты с useTranslation().
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ru from '../../public/locales/ru/translation.json';
import uz from '../../public/locales/uz/translation.json';
import en from '../../public/locales/en/translation.json';

// ─── Locale из sessionStorage (синхронно) ────────────────────────────────────

const SUPPORTED = ['ru', 'uz', 'en'];

function getInitialLocale(): string {
  // 1. Ранее сохранённый пользователем язык (localStorage — durable между
  //    перезагрузками TWA; sessionStorage сбрасывался и язык «слетал»).
  let cached: string | null = null;
  try {
    cached = localStorage.getItem('user_language');
  } catch {
    cached = null;
  }
  if (cached && SUPPORTED.includes(cached)) return cached;
  // 2. Язык Telegram (TWA — window.Telegram.WebApp доступен синхронно)
  try {
    const tgLang =
      (
        window as Window & {
          Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } };
        }
      ).Telegram?.WebApp?.initDataUnsafe?.user?.language_code ?? 'ru';
    if (SUPPORTED.includes(tgLang)) return tgLang;
  } catch {
    // Вне Telegram — игнорируем
  }
  return 'ru';
}

// ─── Инициализация ────────────────────────────────────────────────────────────

void i18n.use(initReactI18next).init({
  lng: getInitialLocale(),
  fallbackLng: 'ru',
  resources: {
    ru: { translation: ru },
    uz: { translation: uz },
    en: { translation: en },
  },
  interpolation: {
    // React сам экранирует — не нужно двойное экранирование
    escapeValue: false,
  },
});

export default i18n;
