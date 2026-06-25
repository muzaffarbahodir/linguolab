import { test, expect } from '@playwright/test';
import { loginAsTeacher } from './helpers/auth';

/**
 * Teacher portal smoke tests.
 */
test.describe('Teacher — dashboard', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsTeacher(context, page);
  });

  test('shows teacher dashboard', async ({ page }) => {
    await page.goto('/teacher');
    await expect(page).not.toHaveURL(/\/login/);
    // Teacher nav should show "Учитель" badge
    await expect(page.locator('text=Учитель').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows my classes section', async ({ page }) => {
    await page.goto('/teacher');
    await expect(page.locator('text=Английский A2').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Teacher — class detail', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsTeacher(context, page);
  });

  test('shows student list for class', async ({ page }) => {
    await page.goto('/teacher/classes/class-1');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('text=Иван').first()).toBeVisible({ timeout: 10_000 });
  });

  test('has links to lessons and homework', async ({ page }) => {
    await page.goto('/teacher/classes/class-1');
    await expect(page.locator('a', { hasText: 'Уроки' }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('a', { hasText: 'ДЗ' }).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Teacher — lessons', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsTeacher(context, page);
  });

  test('shows lessons list', async ({ page }) => {
    await page.goto('/teacher/classes/class-1/lessons');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('text=Урок 1').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can open create lesson form', async ({ page }) => {
    await page.goto('/teacher/classes/class-1/lessons');
    await page.locator('button', { hasText: 'Добавить' }).first().click();
    await expect(page.locator('input[placeholder*="Урок"]')).toBeVisible();
  });

  test('creates a new lesson', async ({ page }) => {
    await page.goto('/teacher/classes/class-1/lessons');
    await page.locator('button', { hasText: 'Добавить' }).first().click();

    await page.locator('input[placeholder*="Урок"]').fill('Урок 3 — Тест');
    // Fill datetime-local inputs
    const dateInputs = page.locator('input[type="datetime-local"]');
    await dateInputs.nth(0).fill('2026-06-01T10:00');
    await dateInputs.nth(1).fill('2026-06-01T11:30');

    await page.locator('button[type="submit"]').click();

    // New lesson should appear in the list
    await expect(page.locator('text=Урок 3').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Teacher — homework', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsTeacher(context, page);
  });

  test('shows homework list with submissions', async ({ page }) => {
    await page.goto('/teacher/classes/class-1/homework');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('text=Выучить 20 слов').first()).toBeVisible({ timeout: 10_000 });
  });

  test('shows submitted student work', async ({ page }) => {
    await page.goto('/teacher/classes/class-1/homework');
    // Mock data has Иван as submitted student
    await expect(page.locator('text=Иван').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can grade a submission', async ({ page }) => {
    await page.goto('/teacher/classes/class-1/homework');

    // Grade input should be visible for SUBMITTED status
    const gradeInput = page.locator('input[type="number"]').first();
    await expect(gradeInput).toBeVisible({ timeout: 10_000 });

    await gradeInput.fill('95');
    await page.locator('button', { hasText: 'Выставить оценку' }).first().click();

    // After grading, status changes to GRADED
    await expect(page.locator('text=Оценено').first()).toBeVisible({ timeout: 10_000 });
  });

  test('can create new homework', async ({ page }) => {
    await page.goto('/teacher/classes/class-1/homework');
    await page.locator('button', { hasText: 'Выдать ДЗ' }).click();

    await page.locator('input[required]').fill('Новое задание E2E');
    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Новое задание E2E').first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Teacher — schedule', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsTeacher(context, page);
  });

  test('shows schedule page with upcoming lessons', async ({ page }) => {
    await page.goto('/teacher/schedule');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('text=Расписание').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Урок 1').first()).toBeVisible({ timeout: 10_000 });
  });
});
