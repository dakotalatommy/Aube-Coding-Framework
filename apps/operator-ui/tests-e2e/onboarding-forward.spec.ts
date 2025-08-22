import { test, expect } from '@playwright/test';

test('Onboarding auto-forwards to dashboard tour', async ({ page }) => {
  await page.goto('/onboarding?tour=1');
  await page.waitForLoadState('domcontentloaded');

  // Wait for auto-forward without interacting with overlay
  await page.waitForURL('**/workspace?pane=dashboard&tour=1', { timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  // Dashboard should render; verify the dashboard guide button exists
  await expect(page.getByRole('button', { name: /Guide me/i })).toBeVisible({ timeout: 20000 });
});


