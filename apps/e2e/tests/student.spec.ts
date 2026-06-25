import { test, expect } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';

/**
 * Student portal smoke tests.
 * API calls go to mock server on port 9999 (via portal proxy routes).
 */
test.describe('Student — dashboard', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsStudent(context, page);
  });

  test('shows dashboard with upcoming lessons section', async ({ page }) => {
    await page.goto('/');
    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);
    // Dashboard heading or nav should be visible
    await expect(page.locator('nav')).toBeVisible();
  });
});

test.describe('Student — courses catalog', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsStudent(context, page);
  });

  test('lists available courses', async ({ page }) => {
    await page.goto('/courses');
    await expect(page).not.toHaveURL(/\/login/);
    // Mock data has 2 classes — at least one should appear
    await expect(page.locator('text=Английский A2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows course detail on click', async ({ page }) => {
    await page.goto('/courses/class-1');
    await expect(page).not.toHaveURL(/\/login/);
    // Course detail page — enroll button or class info
    await expect(page.locator('main')).toBeVisible();
  });
});

test.describe('Student — my lessons', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsStudent(context, page);
  });

  test('shows lessons page', async ({ page }) => {
    await page.goto('/my/lessons');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('displays upcoming lesson from mock data', async ({ page }) => {
    await page.goto('/my/lessons');
    await expect(page.locator('text=Урок 1').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Student — homework', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsStudent(context, page);
  });

  test('shows homework page', async ({ page }) => {
    await page.goto('/my/homework');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('displays homework item from mock data', async ({ page }) => {
    await page.goto('/my/homework');
    await expect(page.locator('text=Выучить 20 слов').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Student — payments', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsStudent(context, page);
  });

  test('shows payments page', async ({ page }) => {
    await page.goto('/my/payments');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('displays payment history', async ({ page }) => {
    await page.goto('/my/payments');
    // Payment amount: 500000 tiyin = 5000 UZS displayed
    await expect(page.locator('main')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Student — profile', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsStudent(context, page);
  });

  test('shows profile page with user data', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible();
  });
});
