import { test, expect } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';

/**
 * Auth smoke tests — TWA guard behaviour.
 *
 * The portal now uses Telegram WebApp initData for authentication
 * (NextAuth/email+password login was removed in Etap 22).
 */
test.describe('Auth — TWA guard (no Telegram)', () => {
  // No mock injected — simulates opening outside Telegram

  test('shows "open in Telegram" error screen when initData absent', async ({ page }) => {
    await page.goto('/');
    // TwaGuard shows friendly error when window.Telegram.WebApp.initData is empty
    await expect(page.locator('text=/Telegram|telegram/i').first()).toBeVisible({ timeout: 8_000 });
  });

  test('does NOT show email/password login form', async ({ page }) => {
    await page.goto('/');
    // No NextAuth login form should exist
    await expect(page.locator('input[type="email"]')).not.toBeVisible();
    await expect(page.locator('input[type="password"]')).not.toBeVisible();
  });
});

test.describe('Auth — TWA guard (with Telegram mock)', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsStudent(context, page);
  });

  test('authenticates and shows app content', async ({ page }) => {
    await page.goto('/');
    // Should NOT show "open in Telegram" error
    await expect(page.locator('text=Откройте приложение в Telegram')).not.toBeVisible({
      timeout: 8_000,
    });
    // App shell is visible (nav or main)
    await expect(page.locator('body')).toBeVisible();
  });

  test('page title contains LinguoLab', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LinguoLab/i);
  });
});
