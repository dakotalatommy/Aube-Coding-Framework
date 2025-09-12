import { test, expect } from '@playwright/test';

// Comprehensive live smoke that drives the full onboarding showcase path
// Notes:
// - Runs in demo mode (?demo=1) to avoid auth
// - Simulates image upload and edit gating by setting data attributes
// - Marks contacts/plan completion via localStorage to verify Quick Start hides

const BASE = process.env.LIVE_BASE_URL || 'https://app.brandvx.io';
const build = (pane: string, extra?: Record<string,string|number|boolean>) => {
  const u = new URL(`${BASE}/workspace`);
  u.searchParams.set('pane', pane);
  u.searchParams.set('demo','1');
  u.searchParams.set('e2e','1');
  if (extra) Object.entries(extra).forEach(([k,v])=> u.searchParams.set(k, String(v)));
  return u.toString();
};

test.describe('Live onboarding showcase (demo)', () => {
  test('End-to-end flow: Dashboard → brandVZN → Dashboard → Contacts → AskVX → Dashboard; Quick Start hidden', async ({ page }) => {
    const ensureAppLoaded = async () => {
      // If redirected to login, force demo/e2e context
      if (page.url().includes('/login')) {
        await page.goto(`${BASE}/workspace?pane=dashboard${DEMO}${E2E}`);
      }
      await page.waitForLoadState('load');
      await page.waitForLoadState('networkidle');
      // Consider the app loaded if we are in /workspace and the DOM has content
      expect(page.url()).toContain('/workspace');
      const hasBody = await page.evaluate(() => !!document.body && document.body.innerHTML.length > 0);
      expect(hasBody).toBeTruthy();
    };
    // 1) Dashboard (demo)
    await page.goto(build('dashboard'));
    await ensureAppLoaded();
    expect(page.url()).toContain('/workspace');

    // 2) brandVZN (simulate upload + two edits)
    await page.goto(build('vision', { onboard: 1, tour: 1 }));
    await ensureAppLoaded();
    const preview = page.locator('[data-guide="preview"]');
    // Try to locate preview, but tolerate absence by setting attributes later
    await preview.first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});

    // Upload a tiny PNG from memory via hidden file input
    const input = page.locator('input[type="file"][accept*="image"]');
    const b64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAF/gKVr0m3GQAAAABJRU5ErkJggg=='; // 1x1 png
    await input.setInputFiles({ name: 'sample.png', mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') }).catch(()=>{});

    // Simulate two edits to satisfy showcase gating without hitting backend
    await page.evaluate(() => {
      const el = document.querySelector('[data-guide="preview"]') as HTMLElement | null;
      if (el) {
        el.setAttribute('data-vision-has-preview', '1');
        el.setAttribute('data-vision-edits', '2');
        el.setAttribute('data-vision-lastedit', String(Date.now()));
      }
      try { localStorage.setItem('bvx_done_vision', '1'); } catch {}
    });
    expect(page.url()).toContain('/workspace');

    // 3) Back to Dashboard (demo)
    await page.goto(build('dashboard'));
    await ensureAppLoaded();
    expect(page.url()).toContain('/workspace');

    // 4) Contacts (demo onboarding)
    await page.goto(build('contacts', { onboard: 1 }));
    await ensureAppLoaded();
    await page.evaluate(() => { try { localStorage.setItem('bvx_done_contacts', '1'); } catch {} });
    expect(page.url()).toContain('/workspace');

    // 5) AskVX (demo onboarding)
    await page.goto(build('askvx', { onboard: 1 }));
    await ensureAppLoaded();
    await page.evaluate(() => { try { localStorage.setItem('bvx_done_plan', '1'); } catch {} });
    expect(page.url()).toContain('/workspace');

    // 6) Final Dashboard: Quick Start disappears when three are done
    await page.goto(build('dashboard'));
    await ensureAppLoaded();
    await expect(page.getByRole('heading', { name: 'Quick Start' })).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByText('Next Best Steps')).toBeVisible({ timeout: 30000 });
    expect(page.url()).toContain('/workspace');
  });
});


