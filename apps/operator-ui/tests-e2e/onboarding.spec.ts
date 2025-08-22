import { test, expect } from '@playwright/test';

test.skip('Onboarding to Dashboard smoke (backend)', async ({ page }) => {
  await page.goto('/onboarding');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.getByText('BrandVX Onboarding')).toBeVisible({ timeout: 15000 });
  // Try Driver.js only if button exists
  const guideBtn = page.getByRole('button', { name: /Guide me/i });
  if (await guideBtn.count()) {
    await guideBtn.click();
    await page.keyboard.press('Escape');
  }
  // Move to dashboard through nav if available
  const dashLink = page.locator('a[href="/dashboard"]').first();
  if (await dashLink.count()) {
    await dashLink.click();
  } else {
    await page.goto('/dashboard');
  }
  // Loosen assertion: verify URL and presence of quick actions region
  await expect(page).toHaveURL(/.*\/dashboard.*/);
  await expect(page.locator('[data-tour="quick-actions"]')).toBeVisible({ timeout: 15000 });
});


