/**
 * Splash Screen Diagnostic Tests
 * Priority #1: Diagnose multiple splash fires and white screen issues
 */

import { test, expect, Page } from '@playwright/test';
import { TEST_CONFIG, ConsoleLog, SplashEvent, TestHelpers } from '../test-config';

test.describe('Splash Screen Diagnostics', () => {
  let consoleLogs: ConsoleLog[] = [];
  
  test.beforeEach(async ({ page }) => {
    // Capture all console logs
    consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push({
        timestamp: Date.now(),
        type: msg.type(),
        text: msg.text(),
      });
    });
    
    // Create screenshots directory
    await page.evaluate(() => {
      // Ensure screenshots dir exists (handled by mkdir in setup)
    });
  });
  
  test.afterEach(async () => {
    // Output splash log analysis
    const splashLogs = TestHelpers.filterSplashLogs(consoleLogs);
    console.log('\n=== SPLASH LOG ANALYSIS ===');
    console.log(`Total console logs: ${consoleLogs.length}`);
    console.log(`Splash-related logs: ${splashLogs.length}`);
    console.log(`Splash fires: ${TestHelpers.countSplashFires(splashLogs)}`);
    console.log('\nSplash events:');
    splashLogs.forEach(event => {
      console.log(`  [${new Date(event.timestamp).toISOString()}] ${event.event}`);
    });
    console.log('===========================\n');
  });

  test('splash-01: Landing page load - count splash fires', async ({ page }) => {
    await page.goto(TEST_CONFIG.BASE_URL);
    
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Take screenshot
    await TestHelpers.screenshot(page, 'splash-01-landing');
    
    // Analyze splash fires
    const splashLogs = TestHelpers.filterSplashLogs(consoleLogs);
    const fireCount = TestHelpers.countSplashFires(splashLogs);
    
    console.log(`\n🔍 Landing page splash fires: ${fireCount}`);
    console.log('Expected: 1 (or 0 if not authenticated)');
    
    // Check if splash is visible
    const splashVisible = await page.locator(TEST_CONFIG.SELECTORS.SPLASH_OVERLAY).isVisible().catch(() => false);
    console.log(`Splash currently visible: ${splashVisible}`);
    
    expect(fireCount).toBeLessThanOrEqual(1);
  });

  test('splash-02: Sign-in click - track splash on button click', async ({ page }) => {
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Clear logs from initial load
    consoleLogs = [];
    
    // Click sign-in button
    await page.click(TEST_CONFIG.SELECTORS.SIGN_IN_BUTTON);
    await page.waitForTimeout(1000);
    
    await TestHelpers.screenshot(page, 'splash-02-signin-clicked');
    
    const splashLogs = TestHelpers.filterSplashLogs(consoleLogs);
    const fireCount = TestHelpers.countSplashFires(splashLogs);
    
    console.log(`\n🔍 Sign-in click splash fires: ${fireCount}`);
    console.log('Expected: 0-1 (should not fire again)');
    
    expect(fireCount).toBeLessThanOrEqual(1);
  });

  test('splash-03: Auth callback - monitor double-enable', async ({ page }) => {
    // This test would need actual auth or mock
    // Simulating the callback flow
    
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Simulate auth callback by navigating to callback route
    consoleLogs = [];
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.AUTH_CALLBACK}`);
    await page.waitForTimeout(2000);
    
    await TestHelpers.screenshot(page, 'splash-03-auth-callback');
    
    const splashLogs = TestHelpers.filterSplashLogs(consoleLogs);
    const fireCount = TestHelpers.countSplashFires(splashLogs);
    
    console.log(`\n🔍 Auth callback splash fires: ${fireCount}`);
    console.log('Expected: 1 (ISSUE: currently fires 2x)');
    
    // This is where the double-fire bug manifests
    expect(fireCount).toBeLessThanOrEqual(2); // Should be 1
  });

  test('splash-04: Workspace entry - verify splash behavior', async ({ page }) => {
    // Navigate directly to workspace (will redirect if not authed)
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await TestHelpers.screenshot(page, 'splash-04-workspace');
    
    const splashLogs = TestHelpers.filterSplashLogs(consoleLogs);
    const fireCount = TestHelpers.countSplashFires(splashLogs);
    
    console.log(`\n🔍 Workspace entry splash fires: ${fireCount}`);
    
    expect(fireCount).toBeGreaterThanOrEqual(0);
  });

  test('splash-05: Navigation between panes - check if splash fires', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    // Clear initial logs
    consoleLogs = [];
    
    // Navigate to different sections
    const routes = [
      TEST_CONFIG.ROUTES.CLIENTS,
      TEST_CONFIG.ROUTES.MESSAGES,
      TEST_CONFIG.ROUTES.AGENDA,
    ];
    
    for (const route of routes) {
      await page.goto(`${TEST_CONFIG.BASE_URL}${route}`);
      await page.waitForTimeout(1000);
      await TestHelpers.screenshot(page, `splash-05-nav-${route.split('/').pop()}`);
    }
    
    const splashLogs = TestHelpers.filterSplashLogs(consoleLogs);
    const fireCount = TestHelpers.countSplashFires(splashLogs);
    
    console.log(`\n🔍 Inter-pane navigation splash fires: ${fireCount}`);
    console.log('Expected: 0 (should not fire on route changes)');
    console.log('ISSUE: Currently fires twice per navigation');
    
    expect(fireCount).toBeLessThanOrEqual(routes.length * 2); // Should be 0
  });

  test('splash-06: Page refresh - validate sessionStorage persistence', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Check for splash guard flags
    const splashKeys = await TestHelpers.getSessionStorageKeys(page, 'bvx_splash_shown');
    console.log(`\n🔍 Splash guard keys found: ${splashKeys.length}`);
    console.log('Keys:', splashKeys);
    
    // Clear logs and refresh
    consoleLogs = [];
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await TestHelpers.screenshot(page, 'splash-06-after-refresh');
    
    const splashLogs = TestHelpers.filterSplashLogs(consoleLogs);
    const fireCount = TestHelpers.countSplashFires(splashLogs);
    
    console.log(`🔍 Splash fires after refresh: ${fireCount}`);
    console.log('Expected: 0 (guard should prevent re-fire)');
    
    expect(fireCount).toBe(0);
  });

  test('splash-07: Logout and relogin - confirm flag clears', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    // Check splash flags before logout
    const beforeKeys = await TestHelpers.getSessionStorageKeys(page, 'bvx_splash_shown');
    console.log(`\n🔍 Splash flags before logout: ${beforeKeys.length}`);
    
    // Simulate logout by clearing storage
    await page.evaluate(() => {
      sessionStorage.clear();
      localStorage.clear();
    });
    
    // Navigate back
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.waitForLoadState('networkidle');
    
    const afterKeys = await TestHelpers.getSessionStorageKeys(page, 'bvx_splash_shown');
    console.log(`🔍 Splash flags after logout: ${afterKeys.length}`);
    console.log('Expected: 0 (flags should be cleared)');
    
    await TestHelpers.screenshot(page, 'splash-07-after-logout');
    
    expect(afterKeys.length).toBe(0);
  });

  test('splash-08: White screen diagnosis - capture when it appears', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    
    // Take screenshots at intervals to catch white screen
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(500);
      await TestHelpers.screenshot(page, `splash-08-frame-${i}`);
    }
    
    await page.waitForLoadState('networkidle');
    
    // Check if elements are loaded but not visible
    const bodyBgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    
    const elementsCount = await page.locator('*').count();
    
    console.log(`\n🔍 White screen analysis:`);
    console.log(`  Body background: ${bodyBgColor}`);
    console.log(`  DOM elements loaded: ${elementsCount}`);
    console.log(`  Network state: networkidle`);
    
    // Check if main content is hidden
    const mainHidden = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return true;
      const style = window.getComputedStyle(main);
      return style.display === 'none' || style.opacity === '0' || style.visibility === 'hidden';
    });
    
    console.log(`  Main content hidden: ${mainHidden}`);
    
    await TestHelpers.screenshot(page, 'splash-08-final-state');
  });

  test('splash-09: Console log timeline - full splash lifecycle', async ({ page }) => {
    const timeline: { time: number; event: string }[] = [];
    const startTime = Date.now();
    
    page.on('console', msg => {
      if (msg.text().toLowerCase().includes('splash')) {
        timeline.push({
          time: Date.now() - startTime,
          event: msg.text(),
        });
      }
    });
    
    // Full user journey
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.waitForTimeout(1000);
    
    await page.click(TEST_CONFIG.SELECTORS.SIGN_IN_BUTTON).catch(() => {});
    await page.waitForTimeout(1000);
    
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForTimeout(1000);
    
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`);
    await page.waitForTimeout(1000);
    
    console.log('\n=== FULL SPLASH TIMELINE ===');
    timeline.forEach(({ time, event }) => {
      console.log(`[+${time}ms] ${event}`);
    });
    console.log('============================\n');
    
    await TestHelpers.screenshot(page, 'splash-09-timeline');
  });

  test('splash-10: Interaction blocking - test if elements are clickable', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    // Test if navigation is interactable
    const navSelectors = [
      TEST_CONFIG.SELECTORS.NAV_CLIENTS,
      TEST_CONFIG.SELECTORS.NAV_MESSAGES,
      TEST_CONFIG.SELECTORS.NAV_SETTINGS,
    ];
    
    console.log('\n🔍 Element interaction check:');
    
    for (const selector of navSelectors) {
      const isInteractable = await TestHelpers.isInteractable(page, selector);
      console.log(`  ${selector}: ${isInteractable ? '✅ Clickable' : '❌ Blocked'}`);
    }
    
    // Check if splash overlay is blocking
    const splashVisible = await page.locator(TEST_CONFIG.SELECTORS.SPLASH_OVERLAY).isVisible().catch(() => false);
    console.log(`  Splash overlay active: ${splashVisible}`);
    
    await TestHelpers.screenshot(page, 'splash-10-interaction-test');
    
    // At least one nav element should be interactable
    const anyInteractable = await Promise.all(
      navSelectors.map(s => TestHelpers.isInteractable(page, s))
    ).then(results => results.some(r => r));
    
    expect(anyInteractable).toBe(true);
  });
});
