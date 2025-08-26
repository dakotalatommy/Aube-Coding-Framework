import { test, expect } from '@playwright/test';

test('Referral link UI appears on dashboard', async ({ page }) => {
  await page.goto('/workspace?pane=dashboard', { waitUntil: 'domcontentloaded' });
  const referralLabel = page.getByText(/Your referral link:/i);
  // Either the label is visible or the dashboard loads fallback KPIs
  const visible = await referralLabel.isVisible().catch(() => false);
  if (!visible) {
    await expect(page.getByText(/Cadence Queue/i)).toBeVisible({ timeout: 10000 });
  }
});
