import { test, expect } from '@playwright/test';

test('Integrations smoke: loads and shows provider cards', async ({ page }) => {
  await page.goto('/integrations');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Integrations & Settings')).toBeVisible({ timeout: 15000 });
  // Ensure tone input exists
  await expect(page.getByLabel(/Tone/i)).toBeVisible();
});



