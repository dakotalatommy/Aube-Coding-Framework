import { test, expect } from '@playwright/test';
import fs from 'fs';

const BASE = process.env.LIVE_BASE_URL || 'https://app.brandvx.io';
const DEMO = '?demo=1&e2e=1&onboard=1';
const GEMINI_IMAGE = '/Users/dakotalatommy/Downloads/gemini photo/IMG_6844.jpg';

test.describe('brandVZN + Gemini smoke (live)', () => {
  test('Upload, analyze, and run edit once', async ({ page }) => {
    // Navigate directly to brandVZN in demo mode with e2e bypass
    await page.goto(`${BASE}/workspace?pane=vision${DEMO}`);
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('brandVZN')).toBeVisible({ timeout: 30000 });

    const preview = page.locator('[data-guide="preview"]');
    await expect(preview).toBeVisible({ timeout: 30000 });

    // Upload a real image from the Gemini files directory
    const buf = fs.readFileSync(GEMINI_IMAGE);
    const input = page.locator('input[type="file"][accept*="image"]');
    await input.setInputFiles({ name: 'IMG_6844.jpg', mimeType: 'image/jpeg', buffer: buf });

    // Preview should render the image
    await expect(preview.locator('img')).toBeVisible({ timeout: 30000 });

    // Click Analyze Photo and wait for the button to toggle state at least once
    const analyzeBtn = page.locator('[data-guide="analyze"]');
    await analyzeBtn.click();
    // While analyzing, label changes to "Analyzing…"
    await expect(analyzeBtn).toHaveText(/Analyzing…|Analyze Photo/i, { timeout: 60000 });

    // Provide a simple edit prompt and run edit
    const editArea = page.locator('textarea');
    await editArea.fill('Change eye color to blue');
    const runBtn = page.locator('[data-guide="edit"]');
    await runBtn.click();

    // Wait for data attribute indicating an edit completed
    await expect(async () => {
      const val = await preview.getAttribute('data-vision-lastedit');
      expect(val && Number(val) > 0).toBeTruthy();
    }).toPass({ timeout: 90000 });
  });
});


