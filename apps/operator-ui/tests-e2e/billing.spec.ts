import { test, expect } from '@playwright/test';

test('Billing page shows lifetime and skip options', async ({ page }) => {
  await page.goto('/billing');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Add payment method' })).toBeVisible();
  // Updated copy: Founding Member button
  await expect(page.getByRole('button', { name: /Lock \$97\/mo \(Founding Member\)/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start subscription — \$147\/mo/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Skip for now/i })).toBeVisible();
});



