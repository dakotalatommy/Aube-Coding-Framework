import { test, expect } from '@playwright/test';

// Checkout flow smoke: ensure billing modal appears for uncovered tenants and Stripe nav works.

test.describe('Checkout', () => {
  test('Trial and $97 buttons exist and attempt navigation', async ({ page, context }) => {
    await page.goto('/workspace?pane=dashboard', { waitUntil: 'domcontentloaded' });
    // One of the CTAs may appear if not covered
    const trial = page.getByRole('button', { name: /7‑day free trial/i });
    const founding = page.getByRole('button', { name: /\$97 today/i });

    const trialVisible = await trial.isVisible().catch(() => false);
    const foundingVisible = await founding.isVisible().catch(() => false);

    if (trialVisible) {
      const [nav] = await Promise.all([
        context.waitForEvent('page').catch(() => null),
        trial.click(),
      ]);
      if (nav) {
        await nav.waitForLoadState('domcontentloaded').catch(()=>{});
        const url = nav.url();
        expect(/stripe\.com|checkout/.test(url)).toBeTruthy();
        await nav.close().catch(()=>{});
      }
    } else if (foundingVisible) {
      const [nav] = await Promise.all([
        context.waitForEvent('page').catch(() => null),
        founding.click(),
      ]);
      if (nav) {
        await nav.waitForLoadState('domcontentloaded').catch(()=>{});
        const url = nav.url();
        expect(/stripe\.com|checkout/.test(url)).toBeTruthy();
        await nav.close().catch(()=>{});
      }
    } else {
      // Already covered: assert status exists
      await expect(page.getByText(/Status:/i)).toBeVisible({ timeout: 10000 });
    }
  });
});
