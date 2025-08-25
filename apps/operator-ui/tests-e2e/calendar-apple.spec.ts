import { test, expect } from '@playwright/test';

test('Calendar hides Apple option when not configured', async ({ page }) => {
  await page.goto('/workspace?pane=calendar');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  // Expect no Apple option by default (feature not configured in test env)
  const appleOption = page.getByRole('option', { name: 'Apple' });
  await expect(appleOption).toHaveCount(0);
});



