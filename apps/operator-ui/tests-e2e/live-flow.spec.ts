import { test, expect } from '@playwright/test';

// Comprehensive live smoke that drives the full onboarding showcase path
// Notes:
// - Runs in demo mode (?demo=1) to avoid auth
// - Simulates image upload and edit gating by setting data attributes
// - Marks contacts/plan completion via localStorage to verify Quick Start hides

const DEMO = '?demo=1';
const E2E = '&e2e=1';
const BASE = process.env.LIVE_BASE_URL || 'https://app.brandvx.io';

test.describe('Live onboarding showcase (demo)', () => {
  test('End-to-end flow: Dashboard → brandVZN → Dashboard → Contacts → AskVX → Dashboard; Quick Start hidden', async ({ page }) => {
    // 1) Dashboard (demo)
    await page.goto(`${BASE}/workspace?pane=dashboard${DEMO}${E2E}`);
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#e2e-ready')).toBeVisible({ timeout: 30000 });
    expect(page.url()).toContain('/workspace');

    // 2) brandVZN (simulate upload + two edits)
    await page.goto(`${BASE}/workspace?pane=vision&onboard=1&tour=1${DEMO}${E2E}`);
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
    const preview = page.locator('[data-guide="preview"]');
    await expect(preview).toBeVisible({ timeout: 30000 });

    // Upload a tiny PNG from memory via hidden file input
    const input = page.locator('input[type="file"][accept*="image"]');
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAF/gKVr0m3GQAAAABJRU5ErkJggg=='; // 1x1 png
    await input.setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') });

    // Wait for an <img> to render inside preview container (before/after image)
    await expect(preview.locator('img')).toBeVisible({ timeout: 30000 });

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
    await page.goto(`${BASE}/workspace?pane=dashboard${DEMO}${E2E}`);
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#e2e-ready')).toBeVisible({ timeout: 30000 });
    expect(page.url()).toContain('/workspace');

    // 4) Contacts (demo onboarding)
    await page.goto(`${BASE}/workspace?pane=contacts&onboard=1${DEMO}${E2E}`);
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { try { localStorage.setItem('bvx_done_contacts', '1'); } catch {} });
    expect(page.url()).toContain('/workspace');

    // 5) AskVX (demo onboarding)
    await page.goto(`${BASE}/workspace?pane=askvx&onboard=1${DEMO}${E2E}`);
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => { try { localStorage.setItem('bvx_done_plan', '1'); } catch {} });
    expect(page.url()).toContain('/workspace');

    // 6) Final Dashboard: Quick Start disappears when three are done
    await page.goto(`${BASE}/workspace?pane=dashboard${DEMO}${E2E}`);
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Quick Start' })).toHaveCount(0);
    await expect(page.getByText('Next Best Steps')).toBeVisible({ timeout: 30000 });
    expect(page.url()).toContain('/workspace');
  });
});


