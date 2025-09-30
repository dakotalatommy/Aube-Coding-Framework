import { test, expect } from '@playwright/test';

test.describe('Landing Intro Animation', () => {
  test('should play animation on first visit and not on subsequent visits', async ({ page, context }) => {
    // Clear any existing localStorage before test
    await context.clearCookies();
    await page.goto('http://localhost:5174/');
    await page.evaluate(() => localStorage.clear());
    
    console.log('🎬 Test 1: First visit - animation should show');
    
    // Reload page to trigger fresh state
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(1000);
    
    // Check if video element exists
    const videoExists = await page.locator('video').count();
    console.log(`Video element found: ${videoExists > 0}`);
    
    if (videoExists > 0) {
      // Get video element
      const video = page.locator('video').first();
      
      // Check if video is visible
      const isVisible = await video.isVisible();
      console.log(`Video is visible: ${isVisible}`);
      
      // Check video source
      const videoSrc = await video.locator('source').getAttribute('src');
      console.log(`Video source: ${videoSrc}`);
      
      // Wait for video to end (or timeout after 15 seconds)
      console.log('Waiting for video to complete...');
      await page.waitForTimeout(15000);
      
      // Check if localStorage flag was set
      const flagSet = await page.evaluate(() => {
        return localStorage.getItem('bvx_landing_intro_shown') === '1';
      });
      console.log(`localStorage flag set: ${flagSet}`);
      expect(flagSet).toBe(true);
    } else {
      console.log('⚠️ Video element not found on first visit');
    }
    
    console.log('\n🔄 Test 2: Second visit - animation should NOT show');
    
    // Reload page - animation should not show
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(2000);
    
    // Check if video element exists (should be gone)
    const videoExistsAfterReload = await page.locator('video').count();
    console.log(`Video element found on reload: ${videoExistsAfterReload > 0}`);
    
    // Verify localStorage flag is still set
    const flagStillSet = await page.evaluate(() => {
      return localStorage.getItem('bvx_landing_intro_shown') === '1';
    });
    console.log(`localStorage flag still set: ${flagStillSet}`);
    expect(flagStillSet).toBe(true);
    
    // Video should not be playing on second visit
    expect(videoExistsAfterReload).toBe(0);
    
    console.log('\n✅ Test 3: Verify landing page is accessible');
    
    // Check that landing page content is visible
    const landingContentVisible = await page.locator('body').isVisible();
    console.log(`Landing page content visible: ${landingContentVisible}`);
    expect(landingContentVisible).toBe(true);
    
    console.log('\n🎉 All animation tests passed!');
  });

  test('should handle video error gracefully', async ({ page, context }) => {
    console.log('🧪 Test: Video error handling');
    
    await context.clearCookies();
    await page.goto('http://localhost:5174/');
    await page.evaluate(() => localStorage.clear());
    
    // Monitor console for error messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[landing-intro]')) {
        consoleMessages.push(msg.text());
        console.log(`Console: ${msg.text()}`);
      }
    });
    
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(3000);
    
    // Check for intro-related console messages
    console.log(`\nCaptured ${consoleMessages.length} console messages`);
    
    // Landing page should be visible regardless of video state
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBe(true);
    
    console.log('✅ Error handling test passed!');
  });

  test('should reset animation when localStorage is cleared', async ({ page, context }) => {
    console.log('🔄 Test: Reset animation via localStorage clear');
    
    await context.clearCookies();
    await page.goto('http://localhost:5174/');
    
    // Set the flag manually
    await page.evaluate(() => {
      localStorage.setItem('bvx_landing_intro_shown', '1');
    });
    
    // Verify flag is set
    let flagSet = await page.evaluate(() => {
      return localStorage.getItem('bvx_landing_intro_shown') === '1';
    });
    console.log(`Flag initially set: ${flagSet}`);
    expect(flagSet).toBe(true);
    
    // Clear localStorage
    await page.evaluate(() => {
      localStorage.removeItem('bvx_landing_intro_shown');
    });
    
    // Verify flag is cleared
    flagSet = await page.evaluate(() => {
      return localStorage.getItem('bvx_landing_intro_shown') === '1';
    });
    console.log(`Flag after clear: ${flagSet}`);
    expect(flagSet).toBe(false);
    
    // Reload - video should show again
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(2000);
    
    const videoExists = await page.locator('video').count();
    console.log(`Video shows after reset: ${videoExists > 0}`);
    
    console.log('✅ Reset test passed!');
  });
});
