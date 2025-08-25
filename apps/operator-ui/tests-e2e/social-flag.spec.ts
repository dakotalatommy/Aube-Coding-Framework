import { test, expect } from '@playwright/test';

test('Social section hidden when feature flag off', async ({ page }) => {
  await page.goto('/workspace?pane=integrations');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Social inbox is not enabled for this environment.')).toBeVisible();
});



