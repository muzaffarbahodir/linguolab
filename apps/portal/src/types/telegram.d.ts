/**
 * Minimal Telegram Web App type declarations.
 * Telegram injects window.Telegram.WebApp when the page is opened inside Telegram.
 */

interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

interface TelegramWebApp {
  /** Raw initData string — must be sent to backend for HMAC validation. */
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
    hash: string;
    auth_date: number;
  };
  ready(): void;
  close(): void;
  expand(): void;
  colorScheme: 'light' | 'dark';
}

interface Window {
  Telegram?: {
    WebApp: TelegramWebApp;
  };
}
