import { test, expect } from '@playwright/test';

test('Dashboard loads with KPIs, queue, and quick actions', async ({ page }) => {
  await page.goto('/workspace?pane=dashboard&demo=1');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByRole('heading', { name: 'Cadence Queue' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open dashboard guide' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Connect Tools' })).toBeVisible();
});


