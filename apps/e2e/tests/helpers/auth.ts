import { BrowserContext, Page } from '@playwright/test';

export const PORTAL_BASE = 'http://localhost:3002';

/**
 * Minimal fake initData string.
 * The mock server accepts any non-empty initData via /auth/telegram/init.
 */
const MOCK_INIT_DATA =
  'user=%7B%22id%22%3A123456%2C%22first_name%22%3A%22Test%22%7D&auth_date=9999999999&hash=mockhash';

const MOCK_STUDENT_USER = {
  id: 'student-1',
  first_name: 'Test',
  last_name: 'Student',
  username: 'teststudent',
  avatar_url: null,
  role: 'STUDENT',
  is_active: true,
  locale: 'ru',
  timezone: 'Asia/Tashkent',
};

const MOCK_TEACHER_USER = {
  ...MOCK_STUDENT_USER,
  id: 'teacher-1',
  first_name: 'Test',
  last_name: 'Teacher',
  role: 'TEACHER',
};

/**
 * Sets up TWA auth mock for a given user.
 *
 * Steps:
 * 1. addInitScript — injects window.Telegram.WebApp with fake initData
 *    so AuthProvider proceeds to call /api/auth/twa.
 * 2. page.route — intercepts POST /api/auth/twa and returns mock user
 *    immediately (no real backend call needed).
 *
 * Must be called BEFORE page.goto() — typically in test.beforeEach.
 */
async function mockTwaAuth(page: Page, user: typeof MOCK_STUDENT_USER) {
  // Inject window.Telegram.WebApp before any script runs
  await page.addInitScript((initData: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).Telegram = {
      WebApp: {
        initData,
        ready: () => {},
        expand: () => {},
        MainButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        HapticFeedback: {
          notificationOccurred: () => {},
          impactOccurred: () => {},
          selectionChanged: () => {},
        },
        CloudStorage: { getItem: () => {}, setItem: () => {} },
        themeParams: {},
      },
    };
  }, MOCK_INIT_DATA);

  // Intercept POST /api/auth/twa — return mock user, set auth_token cookie
  await page.route('**/api/auth/twa', (route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'Set-Cookie': 'auth_token=mock-token; Path=/; HttpOnly; SameSite=Lax',
      },
      body: JSON.stringify({ user }),
    });
  });
}

export async function loginAsStudent(_context: BrowserContext, page: Page) {
  await mockTwaAuth(page, MOCK_STUDENT_USER);
}

export async function loginAsTeacher(_context: BrowserContext, page: Page) {
  await mockTwaAuth(page, MOCK_TEACHER_USER);
}
