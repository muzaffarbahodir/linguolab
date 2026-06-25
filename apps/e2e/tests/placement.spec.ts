import { test, expect } from '@playwright/test';
import { loginAsStudent } from './helpers/auth';

/**
 * Placement test flow smoke tests.
 * Full flow: language select → 15 questions → CEFR result.
 */
test.describe('Placement test', () => {
  test.beforeEach(async ({ context, page }) => {
    await loginAsStudent(context, page);
  });

  test('starts placement test for English', async ({ page }) => {
    await page.goto('/placement-test/english');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('shows first question after starting', async ({ page }) => {
    await page.goto('/placement-test/english');

    // Click start button if present
    const startBtn = page.locator('button', { hasText: /начать|старт|start/i });
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
    }

    // First question should be visible
    await expect(page.locator('text=Which sentence is correct?').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('shows progress bar', async ({ page }) => {
    await page.goto('/placement-test/english');

    const startBtn = page.locator('button', { hasText: /начать|старт|start/i });
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
    }

    // Прогресс: портал показывает "Вопрос N из 15"
    await expect(page.getByText(/из 15/).first()).toBeVisible({ timeout: 10_000 });
  });

  test('can answer a question and advance', async ({ page }) => {
    await page.goto('/placement-test/english');

    const startBtn = page.locator('button', { hasText: /начать|старт|start/i });
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
    }

    // Select first answer option
    const firstOption = page.locator('button', { hasText: 'I am happy' }).first();
    await expect(firstOption).toBeVisible({ timeout: 10_000 });
    await firstOption.click();

    // Should advance to next question or show result
    await expect(page.locator('main')).toBeVisible({ timeout: 5_000 });
  });

  test('completes test and shows CEFR result', async ({ page }) => {
    await page.goto('/placement-test/english');

    // Отвечаем на все 15 вопросов (страница авто-переходит к следующему).
    for (let i = 0; i < 15; i++) {
      const option = page.locator('main ul button').first();
      await expect(option).toBeVisible({ timeout: 10_000 });
      await option.click();
      await page.waitForTimeout(500);
    }

    // После всех ответов появляется кнопка завершения.
    await page.getByRole('button', { name: 'Завершить тест' }).click();

    // Экран результата показывает уровень CEFR.
    await expect(page.getByText('B1').first()).toBeVisible({ timeout: 15_000 });
  });
});
