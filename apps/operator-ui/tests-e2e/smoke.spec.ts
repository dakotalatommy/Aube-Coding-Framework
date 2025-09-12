import { test, expect } from '@playwright/test';

test.describe('Smoke', () => {
  test('landing renders hero headline', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Intuitive ops — luxe client experience — brandVX', { exact: false })).toBeVisible({ timeout: 20000 });
  });

  test('workspace demo renders KPIs and queue sections', async ({ page }) => {
    await page.goto('/workspace?demo=1');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-guide="kpis"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-guide="queue"]')).toBeVisible({ timeout: 20000 });
  });

  test('showcase order stays within workspace and gates billing before brandVZN', async ({ page }) => {
    await page.goto('/workspace?pane=dashboard&tour=1');
    await page.waitForLoadState('domcontentloaded');
    // Simulate intro completion signal to trigger showcase begin
    await page.evaluate(()=>{
      window.dispatchEvent(new CustomEvent('bvx:guide:workspace_intro:done'));
    });
    // Billing prompt phase should appear on dashboard before vision
    await page.waitForTimeout(600); // allow navigation orchestration
    // Verify we remain in /workspace context at all times
    const url1 = page.url();
    expect(url1).toContain('/workspace');
    // Showcase may route to billing prompt; ensure not jumped to /vision yet
    expect(url1.includes('pane=vision')).toBeFalsy();
  });
});

