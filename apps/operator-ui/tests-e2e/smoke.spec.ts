import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('landing renders hero headline', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Intuitive ops — luxe client experience — brandVX', { exact: false })).toBeVisible({ timeout: 20000 });
  });

  test('workspace demo renders KPIs and queue sections', async ({ page }) => {
    await page.goto('/workspace?demo=1');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-guide="kpis"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-guide="queue"]')).toBeVisible({ timeout: 20000 });
  });
});

