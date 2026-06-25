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

    // Progress indicator (e.g. "1 / 15" or progress bar element)
    await expect(
      page.locator('[role="progressbar"], text=/\\d+\\s*\\/\\s*15/').first(),
    ).toBeVisible({
      timeout: 10_000,
    });
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

    const startBtn = page.locator('button', { hasText: /начать|старт|start/i });
    if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await startBtn.click();
    }

    // Answer all 15 questions — mock server returns "done" after index 14
    for (let i = 0; i < 15; i++) {
      // Pick any option that's visible
      const option = page
        .locator('button')
        .filter({ hasText: /Option|am|A|B|C|D/i })
        .first();
      const isVisible = await option.isVisible({ timeout: 5_000 }).catch(() => false);
      if (!isVisible) break; // result screen reached
      await option.click();
      await page.waitForTimeout(300);
    }

    // Result screen should show CEFR level
    await expect(page.locator('text=B1').first()).toBeVisible({ timeout: 15_000 });
  });
});
