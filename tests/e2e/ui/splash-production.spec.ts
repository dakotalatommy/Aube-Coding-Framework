import { test, expect } from '@playwright/test';

test.describe('Production Splash Diagnostics', () => {
  
  test('splash-prod-01: Landing page - should NOT show splash before animation', async ({ page }) => {
    console.log('\n🎬 Testing landing page...');
    
    // Track all splash-related console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[splash]')) {
        consoleLogs.push(`[${new Date().toISOString()}] ${text}`);
      }
    });

    await page.goto('/');
    await page.waitForTimeout(5000); // Wait for animation
    
    // Check if splash overlay appeared
    const splashOverlay = page.locator('[data-testid="splash-screen"], .splash-screen, div:has-text("Loading")').first();
    const splashVisible = await splashOverlay.isVisible().catch(() => false);

    console.log('\n📊 Landing Page Results:');
    console.log('   Splash visible:', splashVisible ? '❌ YES (SHOULD NOT BE)' : '✅ NO');
    console.log('   Splash logs:', consoleLogs.length);
    consoleLogs.forEach(log => console.log('   -', log));

    await page.screenshot({ path: 'screenshots/prod-splash-landing.png', fullPage: true });

    expect(splashVisible, 'Splash should NOT appear on landing page').toBe(false);
  });

  test('splash-prod-02: Sign-in flow - count splash fires', async ({ page }) => {
    console.log('\n🔐 Testing sign-in splash...');
    
    const splashEvents: Array<{time: string, event: string}> = [];
    let splashFireCount = 0;

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[splash]') && text.includes('enable')) {
        splashFireCount++;
        splashEvents.push({
          time: new Date().toISOString(),
          event: text
        });
      }
    });

    // Already authenticated from global setup, go to workspace
    await page.goto('/workspace/dashboard');
    await page.waitForTimeout(3000);

    console.log('\n📊 Sign-in Splash Results:');
    console.log('   Total splash fires:', splashFireCount);
    console.log('   Expected: 1 (on initial sign-in)');
    splashEvents.forEach((evt, i) => {
      console.log(`   ${i+1}. ${evt.time} - ${evt.event}`);
    });

    await page.screenshot({ path: 'screenshots/prod-splash-signin.png' });

    // Expect 1 or 0 (since we're already auth'd from global setup)
    expect(splashFireCount).toBeLessThanOrEqual(1);
  });

  test('splash-prod-03: Navigation - track splash on route changes', async ({ page }) => {
    console.log('\n🧭 Testing navigation splash...');
    
    const navigationSplashEvents: Array<{route: string, fires: number, whiteScreen: boolean}> = [];

    async function testNavigation(from: string, to: string, label: string) {
      let splashCount = 0;
      
      page.on('console', msg => {
        if (msg.text().includes('[splash]') && msg.text().includes('enable')) {
          splashCount++;
        }
      });

      await page.goto(from);
      await page.waitForTimeout(1000);

      splashCount = 0; // Reset before navigation
      
      await page.click(`a[href="${to}"], button:has-text("${label}")`).catch(() => {
        console.log(`   ⚠️  Could not find link to ${label}`);
      });
      
      await page.waitForTimeout(3000);

      // Check for white screen (no content visible)
      const hasContent = await page.locator('main, [role="main"], h1, h2').first().isVisible().catch(() => false);
      const whiteScreen = !hasContent;

      navigationSplashEvents.push({
        route: `${from} → ${to}`,
        fires: splashCount,
        whiteScreen
      });

      console.log(`   ${label}: Splash fired ${splashCount}x, White screen: ${whiteScreen ? '❌ YES' : '✅ NO'}`);
      
      if (whiteScreen || splashCount > 0) {
        await page.screenshot({ path: `screenshots/prod-nav-${label.toLowerCase()}.png` });
      }
    }

    // Test key navigations
    await testNavigation('/workspace/dashboard', '/workspace/clients', 'Clients');
    await testNavigation('/workspace/clients', '/workspace/messages', 'Messages');
    await testNavigation('/workspace/messages', '/workspace/agenda', 'Agenda');
    await testNavigation('/workspace/agenda', '/workspace/inventory', 'Inventory');

    console.log('\n📊 Navigation Splash Summary:');
    navigationSplashEvents.forEach(evt => {
      console.log(`   ${evt.route}: ${evt.fires} fires, White screen: ${evt.whiteScreen}`);
    });

    // Expect NO splash fires on navigation
    const totalFires = navigationSplashEvents.reduce((sum, evt) => sum + evt.fires, 0);
    const anyWhiteScreens = navigationSplashEvents.some(evt => evt.whiteScreen);

    console.log(`\n   Total splash fires across all navigation: ${totalFires}`);
    console.log(`   Any white screens: ${anyWhiteScreens ? '❌ YES' : '✅ NO'}`);

    expect(totalFires, 'Splash should NOT fire on navigation').toBe(0);
    expect(anyWhiteScreens, 'No white screens should appear').toBe(false);
  });

  test('splash-prod-04: Full flow - landing → sign-in → navigate', async ({ page, context }) => {
    console.log('\n🎯 Testing full user flow...');
    
    // Clear auth state for this test
    await context.clearCookies();
    await context.clearPermissions();
    
    const timeline: Array<{step: string, splashFires: number, screenshot: string}> = [];
    
    let currentSplashCount = 0;
    page.on('console', msg => {
      if (msg.text().includes('[splash]') && msg.text().includes('enable')) {
        currentSplashCount++;
      }
    });

    // Step 1: Landing
    currentSplashCount = 0;
    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'screenshots/prod-flow-1-landing.png', fullPage: true });
    timeline.push({ step: 'Landing', splashFires: currentSplashCount, screenshot: 'prod-flow-1-landing.png' });

    // Step 2: Click Sign In
    currentSplashCount = 0;
    await page.click('button:has-text("Sign in"), a:has-text("Sign in")').catch(() => {});
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/prod-flow-2-signin-click.png' });
    timeline.push({ step: 'Sign-in click', splashFires: currentSplashCount, screenshot: 'prod-flow-2-signin-click.png' });

    // Step 3: Fill credentials and submit
    if (await page.locator('input[type="email"]').isVisible().catch(() => false)) {
      currentSplashCount = 0;
      await page.fill('input[type="email"]', 'playwright-test@brandvx.test');
      await page.fill('input[type="password"]', 'PlaywrightTest123!@#');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'screenshots/prod-flow-3-after-signin.png', fullPage: true });
      timeline.push({ step: 'After sign-in', splashFires: currentSplashCount, screenshot: 'prod-flow-3-after-signin.png' });
    }

    // Step 4: Navigate
    currentSplashCount = 0;
    await page.click('a[href="/workspace/clients"]').catch(() => {});
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/prod-flow-4-after-nav.png', fullPage: true });
    timeline.push({ step: 'After navigation', splashFires: currentSplashCount, screenshot: 'prod-flow-4-after-nav.png' });

    console.log('\n📊 Full Flow Timeline:');
    timeline.forEach((entry, i) => {
      console.log(`   ${i+1}. ${entry.step}: ${entry.splashFires} splash fires`);
    });

    const totalSplashFires = timeline.reduce((sum, entry) => sum + entry.splashFires, 0);
    console.log(`\n   Total splash fires: ${totalSplashFires}`);
    console.log(`   Expected: 1 (only on sign-in)`);
  });
});
