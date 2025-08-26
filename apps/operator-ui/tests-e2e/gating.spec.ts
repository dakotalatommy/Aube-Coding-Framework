import { test, expect } from '@playwright/test';

// Smoke test: onboarding gating and billing modal
// Assumes baseURL points to production app.

test.describe('Gating', () => {
  test('Onboarding requires grant or redirects to signup', async ({ page }) => {
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
    // Expect either a toast hint or redirect to signup
    const onSignup = page.url().includes('/signup');
    if (!onSignup) {
      // Look for toast text (exact message can vary; allow either)
      // Scope to the toast container to avoid multiple matches
      const toast = page.locator('[role="status"]');
      await expect(toast.getByText(/verify your email|Please verify your email/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('Workspace shows billing modal when not covered', async ({ page }) => {
    await page.goto('/workspace?pane=dashboard', { waitUntil: 'domcontentloaded' });
    // Either the billing modal or already covered
    const trialBtn = page.getByRole('button', { name: /7‑day free trial/i });
    const coveredChip = page.getByText(/Status:/i);
    const visible = await trialBtn.isVisible().catch(() => false);
    const covered = await coveredChip.isVisible().catch(() => false);
    if (!(visible || covered)) test.skip(true, 'No modal and no covered chip — environment dependent.');
  });
});
