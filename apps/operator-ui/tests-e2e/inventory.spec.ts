import { test, expect } from '@playwright/test';

test('Inventory shows empty state in demo', async ({ page }) => {
  await page.goto('/workspace?pane=inventory&demo=1');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await expect(page.getByText('No inventory yet')).toBeVisible();
});



