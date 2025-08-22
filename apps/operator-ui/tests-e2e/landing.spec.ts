import { test, expect } from '@playwright/test';

// Basic e2e for BrandVX landing
// - Loads /brandvx
// - Verifies hero text and CTA
// - Clicks CTA to navigate to workspace (demo)
// - Returns and clicks first workflow tile

test('Landing hero renders and CTA navigates to workspace demo', async ({ page }) => {
  await page.goto('/brandvx');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('Intuitive ops — luxe client experience — brandVX')).toBeVisible();
  await expect(page.getByRole('button', { name: /Try the demo today/ })).toBeVisible();

  // Click CTA
  await page.getByRole('button', { name: /Try the demo today/ }).click();
  await page.waitForURL('**/workspace**', { timeout: 10000 });
});

// Optional smoke: workflow tile is focusable and clickable
// (We check focusability without asserting navigation target to keep backend-agnostic)

test('Landing tiles are accessible and focusable', async ({ page }) => {
  await page.goto('/brandvx');
  const firstTile = page.locator('[aria-label*="Connect tools"]').first();
  await expect(firstTile).toBeVisible();
  await firstTile.focus();
  await expect(firstTile).toBeFocused();
});
