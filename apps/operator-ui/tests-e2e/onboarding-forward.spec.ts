import { test, expect } from '@playwright/test';

test('Onboarding auto-forwards to dashboard tour', async ({ page }) => {
  await page.goto('/onboarding?tour=1');
  await page.waitForLoadState('domcontentloaded');

  // In production, this path requires a grant and may redirect to signup; skip if redirected
  if (page.url().includes('/signup')) test.skip(true, 'Onboarding requires email grant in production.');
  // Otherwise, allow the forward assertion
  await page.waitForURL('**/workspace?pane=dashboard&tour=1', { timeout: 10000 });
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('button', { name: /Guide me/i })).toBeVisible({ timeout: 20000 });
});


