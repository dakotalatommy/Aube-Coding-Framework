import { test, expect } from '@playwright/test';

test.describe('Integrations Redirects Panel', () => {
  test('shows OAuth callback URIs and Stripe webhook', async ({ page }) => {
    await page.goto('/workspace?pane=integrations');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the panel header
    await expect(page.getByText('Redirect URIs')).toBeVisible({ timeout: 10000 });

    // Verify a few specific entries render
    await expect(page.locator('input[value$="/oauth/google/callback"]')).toBeVisible();
    await expect(page.locator('input[value$="/oauth/square/callback"]')).toBeVisible();
    await expect(page.locator('input[value$="/billing/webhook"]')).toBeVisible();
  });
});



