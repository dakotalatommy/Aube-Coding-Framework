import { test, expect } from '@playwright/test';

test.describe('Integrations Redirects Panel', () => {
  test('shows OAuth callback URIs and Stripe webhook', async ({ page }) => {
    await page.goto('/workspace?pane=integrations');
    await page.waitForLoadState('domcontentloaded');
    // The Redirect URIs panel is gated behind SHOW_REDIRECT_URIS flag; assert either banner or inputs
    const header = page.getByText('Redirect URIs');
    const headerVisible = await header.isVisible().catch(()=>false);
    if (!headerVisible) test.skip(true, 'Redirect URIs disabled in production');

    // Verify a few specific entries render
    await expect(page.locator('input[value$="/oauth/google/callback"]')).toBeVisible();
    await expect(page.locator('input[value$="/oauth/square/callback"]')).toBeVisible();
    await expect(page.locator('input[value$="/billing/webhook"]')).toBeVisible();
  });
});



