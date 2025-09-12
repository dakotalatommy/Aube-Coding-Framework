import { test, expect } from '@playwright/test';

// Comprehensive live smoke that drives the full onboarding showcase path
// Notes:
// - Runs in demo mode (?demo=1) to avoid auth
// - Simulates image upload and edit gating by setting data attributes
// - Marks contacts/plan completion via localStorage to verify Quick Start hides

const DEMO = '?demo=1';
const BASE = process.env.LIVE_BASE_URL || 'https://app.brandvx.io';

test.describe('Live onboarding showcase (demo)', () => {
  test('End-to-end flow: Dashboard → brandVZN → Dashboard → Contacts → AskVX → Dashboard; Quick Start hidden', async ({ page }) => {
    // 1) Dashboard (demo)
    await page.goto(`${BASE}/workspace?pane=dashboard${DEMO}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-guide="kpis"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-guide="quickstart"]')).toBeVisible({ timeout: 15000 });
    expect(page.url()).toContain('/workspace');

    // 2) brandVZN (simulate upload + two edits)
    await page.goto(`${BASE}/workspace?pane=vision&onboard=1&tour=1${DEMO}`);
    await page.waitForLoadState('domcontentloaded');
    const preview = page.locator('[data-guide="preview"]');
    await expect(preview).toBeVisible({ timeout: 15000 });

    // Upload a tiny PNG from memory via hidden file input
    const input = page.locator('input[type="file"][accept*="image"]');
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAF/gKVr0m3GQAAAABJRU5ErkJggg=='; // 1x1 png
    await input.setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });

    // Wait for an <img> to render inside preview container (before/after image)
    await expect(preview.locator('img')).toBeVisible({ timeout: 15000 });

    // Simulate two edits to satisfy showcase gating without hitting backend
    await page.evaluate(() => {
      const el = document.querySelector('[data-guide="preview"]') as HTMLElement | null;
      if (el) {
        el.setAttribute('data-vision-has-preview', '1');
        el.setAttribute('data-vision-edits', '2'); // 2 edits (hair + eyes)
        el.setAttribute('data-vision-lastedit', String(Date.now()));
      }
      try { localStorage.setItem('bvx_done_vision', '1'); } catch {}
    });
    expect(page.url()).toContain('/workspace');

    // 3) Back to Dashboard (demo)
    await page.goto(`${BASE}/workspace?pane=dashboard${DEMO}`);
    await expect(page.locator('[data-guide="kpis"]')).toBeVisible({ timeout: 15000 });
    expect(page.url()).toContain('/workspace');

    // 4) Contacts (demo onboarding)
    await page.goto(`${BASE}/workspace?pane=contacts&onboard=1${DEMO}`);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => { try { localStorage.setItem('bvx_done_contacts', '1'); } catch {} });
    expect(page.url()).toContain('/workspace');

    // 5) AskVX (demo onboarding)
    await page.goto(`${BASE}/workspace?pane=askvx&onboard=1${DEMO}`);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => { try { localStorage.setItem('bvx_done_plan', '1'); } catch {} });
    expect(page.url()).toContain('/workspace');

    // 6) Final Dashboard: Quick Start disappears when three are done
    await page.goto(`${BASE}/workspace?pane=dashboard${DEMO}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-guide="kpis"]')).toBeVisible({ timeout: 15000 });
    // Quick Start hidden
    await expect(page.locator('[data-guide="quickstart"]')).toHaveCount(0);
    // Next Best Steps visible
    await expect(page.locator('[data-guide="next-best-steps"]')).toBeVisible({ timeout: 15000 });
    expect(page.url()).toContain('/workspace');
  });
  
  test('Orchestrator autopilot flows across panes after intro completion event', async ({ page }) => {
    // Start on dashboard demo and skip billing gate
    await page.goto(`${BASE}/workspace?pane=dashboard${DEMO}`);
    await page.waitForLoadState('domcontentloaded');
    await page.evaluate(() => { try { localStorage.setItem('bvx_billing_dismissed','1'); } catch {} });

    // Trigger intro-complete to start showcase
    await page.evaluate(() => { window.dispatchEvent(new CustomEvent('bvx:guide:workspace_intro:done')); });

    // Expect billing step (on dashboard) then vision
    await page.waitForURL('**/workspace?pane=dashboard**', { timeout: 20000 });
    // Next: vision upload wait; set gating attributes
    await page.waitForURL('**/workspace?pane=vision**', { timeout: 20000 });
    await page.waitForSelector('[data-guide="preview"]', { timeout: 15000 });
    await page.evaluate(() => {
      const el = document.querySelector('[data-guide="preview"]') as HTMLElement | null;
      if (el) el.setAttribute('data-vision-has-preview','1');
    });
    // Hair edit
    await page.waitForURL('**/workspace?pane=vision**', { timeout: 20000 });
    await page.evaluate(() => {
      const el = document.querySelector('[data-guide="preview"]') as HTMLElement | null;
      if (el) el.setAttribute('data-vision-edits','1');
    });
    // Eyes refine
    await page.waitForURL('**/workspace?pane=vision**', { timeout: 20000 });
    await page.evaluate(() => {
      const el = document.querySelector('[data-guide="preview"]') as HTMLElement | null;
      if (el) el.setAttribute('data-vision-edits','2');
    });

    // Back to dashboard
    await page.waitForURL('**/workspace?pane=dashboard**', { timeout: 20000 });

    // Contacts
    await page.waitForURL('**/workspace?pane=contacts**', { timeout: 20000 });
    await page.waitForSelector('[data-guide="import"]', { timeout: 15000 });
    await page.evaluate(() => { try { localStorage.setItem('bvx_done_contacts','1'); } catch {} });

    // AskVX
    await page.waitForURL('**/workspace?pane=askvx**', { timeout: 20000 });
    await page.waitForSelector('[data-guide="composer"]', { timeout: 15000 });
    await page.evaluate(() => { try { localStorage.setItem('bvx_done_plan','1'); } catch {} });

    // TrainVX page 2
    await page.waitForURL('**/workspace?pane=askvx**', { timeout: 20000 });

    // Final dashboard
    await page.waitForURL('**/workspace?pane=dashboard**', { timeout: 20000 });
    await page.waitForLoadState('domcontentloaded');
    // Quick Start hidden after done keys
    await expect(page.locator('[data-guide="quickstart"]')).toHaveCount(0);
    await expect(page.locator('[data-guide="next-best-steps"]').first()).toBeVisible({ timeout: 15000 });
  });
});


