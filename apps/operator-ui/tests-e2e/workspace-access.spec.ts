import { test, expect } from '@playwright/test';

test('Workspace access after simulated billing success', async ({ page }) => {
  await page.goto('/workspace?pane=dashboard&billing=success', { waitUntil: 'domcontentloaded' });
  // Billing modal should be dismissed; show status or dashboard content
  const status = page.getByText(/You’re covered — billing active/i);
  const kpis = page.getByTestId('kpis').first().or(page.getByText(/Cadence Queue/i));
  const covered = await status.isVisible().catch(() => false);
  if (!covered) {
    await expect(kpis).toBeVisible({ timeout: 10000 });
  }
});
