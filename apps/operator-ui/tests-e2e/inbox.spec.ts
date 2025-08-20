import { test, expect } from '@playwright/test';

test('Inbox smoke: loads and filters', async ({ page }) => {
  await page.goto('/inbox');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible({ timeout: 15000 });
  // Filter to All
  await page.getByRole('button', { name: /all/i }).click();
  // Search box exists
  await expect(page.getByPlaceholder('Search…')).toBeVisible();
});


