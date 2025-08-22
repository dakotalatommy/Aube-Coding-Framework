import { test, expect } from '@playwright/test';

test.skip('AskVX plan run triggers approvals and allows resume (backend)', async ({ page }) => {
  page.on('console', (msg) => console.log('browser console:', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('pageerror:', err.message));
  // Open Ask page
  await page.goto('/ask');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('textarea[placeholder*="Type your message" ]')).toBeVisible({ timeout: 15000 });

  // Send a prompt to render assistant block with plan buttons
  await page.locator('textarea[placeholder*="Type your message" ]').click();
  await page.locator('textarea[placeholder*="Type your message" ]').fill('Hello');
  await page.getByRole('button', { name: 'Send' }).click();

  // Wait for assistant response to appear
  await expect(page.getByText('BrandVX is typing')).toBeVisible();
  await expect(page.getByText('BrandVX is typing')).toBeHidden({ timeout: 10000 });

  // Run the Book-Filling plan (has an approval step in the backend plan)
  const runButton = page.getByRole('button', { name: /Run plan: Book-Filling/ });
  await expect(runButton).toBeVisible();
  await runButton.click();

  // Expect navigation to approvals on pending
  await page.waitForURL('**/approvals', { timeout: 15000 });
  await expect(page.locator('h3', { hasText: 'Approvals' })).toBeVisible();
});


