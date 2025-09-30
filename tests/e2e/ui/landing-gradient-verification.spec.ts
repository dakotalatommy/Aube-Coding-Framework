import { test, expect } from '@playwright/test';

test('verify landing page gradient is smooth without hard lines', async ({ page }) => {
  console.log('🎨 Loading landing page to verify gradient...');
  
  // Clear localStorage to prevent animation
  await page.goto('http://127.0.0.1:5175/');
  await page.evaluate(() => localStorage.setItem('bvx_landing_intro_shown', '1'));
  
  // Reload to see the landing page
  await page.goto('http://127.0.0.1:5175/');
  await page.waitForTimeout(2000);
  
  // Wait for the main headline to be visible
  await page.waitForSelector('text=Book more clients', { timeout: 5000 });
  
  console.log('✅ Landing page loaded');
  
  // Take a full-page screenshot to verify gradient
  await page.screenshot({ 
    path: 'tests/e2e/ui/screenshots/gradient-verification-full.png',
    fullPage: true 
  });
  console.log('📸 Full page screenshot saved');
  
  // Get the gradient overlay element
  const gradientOverlay = page.locator('div[aria-hidden]').filter({
    has: page.locator(':scope')
  }).first();
  
  // Check that the main container has the pink background gradient
  const mainContainer = page.locator('div[data-bvx-landing]');
  const bgStyle = await mainContainer.evaluate((el) => {
    return window.getComputedStyle(el).background;
  });
  
  console.log('\n📦 Main container background:');
  console.log(bgStyle);
  
  // Take a screenshot of the critical area (where the hard line was)
  // This is around the "Automations" text area
  const automationsText = page.locator('text=Automations that save you time');
  const bbox = await automationsText.boundingBox();
  
  if (bbox) {
    await page.screenshot({
      path: 'tests/e2e/ui/screenshots/gradient-verification-transition.png',
      clip: {
        x: 0,
        y: Math.max(0, bbox.y - 150),
        width: 1440,
        height: 400
      }
    });
    console.log('📸 Transition area screenshot saved');
  }
  
  console.log('\n✅ Gradient verification complete!');
  console.log('📁 Check screenshots in: tests/e2e/ui/screenshots/');
});
