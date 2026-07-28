/**
 * Тема приложения — одна, светлая.
 *
 * Тёмную убрали намеренно. Держать две означало сверять каждый новый экран в
 * обеих, и расхождения всё равно накапливались: шторки с захардкоженным
 * тёмным фоном чернели поверх светлых страниц, а часть текста оставалась
 * белой на белом.
 *
 * Модуль остался, потому что Telegram нужно сообщать цвета нативной шапки и
 * фона — иначе вокруг приложения остаётся тёмная рамка клиента.
 */
import WebApp from '@twa-dev/sdk';

/** Цвета для нативных элементов Telegram — совпадают с --bg и --secondary-bg. */
const TG_VARS: Record<string, string> = {
  '--tg-theme-bg-color': '#e7e1ce',
  '--tg-theme-secondary-bg-color': '#fbf9f3',
  '--tg-theme-text-color': '#1f1d18',
  '--tg-theme-hint-color': '#6b6760',
  '--tg-theme-header-bg-color': '#e7e1ce',
};

const CHROME = '#e7e1ce';

export function applyTheme(): void {
  const root = document.documentElement;
  // Класс light мог остаться в localStorage-эпохе двух тем; переменные теперь
  // лежат в :root, и класс ни на что не влияет — снимаем, чтобы не путал.
  root.classList.remove('light');
  for (const [k, v] of Object.entries(TG_VARS)) root.style.setProperty(k, v);
  try {
    WebApp.setHeaderColor(CHROME);
    WebApp.setBackgroundColor(CHROME);
  } catch {
    // старый клиент Telegram без методов — не критично
  }
}
