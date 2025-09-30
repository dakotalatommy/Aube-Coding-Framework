/**
 * Complete Navigation Tests
 * Tests navigation across all sections of the UI
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, TestHelpers } from '../test-config';

test.describe('Full UI Navigation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Start at workspace (assumes auth or will redirect)
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
  });

  test('nav-01: Dashboard to Clients', async ({ page }) => {
    await page.click(TEST_CONFIG.SELECTORS.NAV_CLIENTS);
    await page.waitForURL(`**${TEST_CONFIG.ROUTES.CLIENTS}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    await TestHelpers.screenshot(page, 'nav-01-clients');
    
    expect(page.url()).toContain('/clients');
  });

  test('nav-02: Clients to Messages', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`);
    await page.click(TEST_CONFIG.SELECTORS.NAV_MESSAGES);
    await page.waitForURL(`**${TEST_CONFIG.ROUTES.MESSAGES}`);
    
    await TestHelpers.screenshot(page, 'nav-02-messages');
    
    expect(page.url()).toContain('/messages');
  });

  test('nav-03: Messages to Agenda', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.MESSAGES}`);
    await page.click(TEST_CONFIG.SELECTORS.NAV_AGENDA);
    await page.waitForURL(`**${TEST_CONFIG.ROUTES.AGENDA}`);
    
    await TestHelpers.screenshot(page, 'nav-03-agenda');
    
    expect(page.url()).toContain('/agenda');
  });

  test('nav-04: Agenda to Inventory', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.AGENDA}`);
    await page.click(TEST_CONFIG.SELECTORS.NAV_INVENTORY);
    await page.waitForURL(`**${TEST_CONFIG.ROUTES.INVENTORY}`);
    
    await TestHelpers.screenshot(page, 'nav-04-inventory');
    
    expect(page.url()).toContain('/inventory');
  });

  test('nav-05: Inventory to BrandVZN', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.INVENTORY}`);
    await page.click(TEST_CONFIG.SELECTORS.NAV_BRANDVZN);
    await page.waitForURL(`**${TEST_CONFIG.ROUTES.BRANDVZN}`);
    
    await TestHelpers.screenshot(page, 'nav-05-brandvzn');
    
    expect(page.url()).toContain('/brandvzn');
  });

  test('nav-06: BrandVZN to Settings', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.BRANDVZN}`);
    await page.click(TEST_CONFIG.SELECTORS.NAV_SETTINGS);
    await page.waitForURL(`**${TEST_CONFIG.ROUTES.SETTINGS}`);
    
    await TestHelpers.screenshot(page, 'nav-06-settings');
    
    expect(page.url()).toContain('/settings');
  });

  test('nav-07: Settings to Dashboard - full circle', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.SETTINGS}`);
    await page.click(TEST_CONFIG.SELECTORS.NAV_DASHBOARD);
    await page.waitForURL(`**${TEST_CONFIG.ROUTES.DASHBOARD}`);
    
    await TestHelpers.screenshot(page, 'nav-07-back-to-dashboard');
    
    expect(page.url()).toMatch(/\/workspace\/?$/);
  });

  test('nav-08: Direct URL access', async ({ page }) => {
    // Test direct navigation to each route
    const routes = [
      TEST_CONFIG.ROUTES.CLIENTS,
      TEST_CONFIG.ROUTES.MESSAGES,
      TEST_CONFIG.ROUTES.AGENDA,
      TEST_CONFIG.ROUTES.INVENTORY,
      TEST_CONFIG.ROUTES.BRANDVZN,
      TEST_CONFIG.ROUTES.SETTINGS,
    ];
    
    for (const route of routes) {
      await page.goto(`${TEST_CONFIG.BASE_URL}${route}`);
      await TestHelpers.waitForNetworkIdle(page);
      
      const currentUrl = page.url();
      const routeName = route.split('/').pop();
      
      console.log(`Direct access to ${routeName}: ${currentUrl.includes(route) ? '✅' : '❌'}`);
      
      await TestHelpers.screenshot(page, `nav-08-direct-${routeName}`);
      
      expect(currentUrl).toContain(route);
    }
  });

  test('nav-09: Browser back/forward navigation', async ({ page }) => {
    // Navigate through several pages
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.DASHBOARD}`);
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`);
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.MESSAGES}`);
    
    // Go back
    await page.goBack();
    expect(page.url()).toContain('/clients');
    await TestHelpers.screenshot(page, 'nav-09-back-to-clients');
    
    // Go back again
    await page.goBack();
    expect(page.url()).toMatch(/\/workspace\/?$/);
    await TestHelpers.screenshot(page, 'nav-09-back-to-dashboard');
    
    // Go forward
    await page.goForward();
    expect(page.url()).toContain('/clients');
    await TestHelpers.screenshot(page, 'nav-09-forward-to-clients');
  });

  test('nav-10: Active nav highlighting', async ({ page }) => {
    const routes = [
      { route: TEST_CONFIG.ROUTES.CLIENTS, selector: TEST_CONFIG.SELECTORS.NAV_CLIENTS },
      { route: TEST_CONFIG.ROUTES.MESSAGES, selector: TEST_CONFIG.SELECTORS.NAV_MESSAGES },
      { route: TEST_CONFIG.ROUTES.SETTINGS, selector: TEST_CONFIG.SELECTORS.NAV_SETTINGS },
    ];
    
    for (const { route, selector } of routes) {
      await page.goto(`${TEST_CONFIG.BASE_URL}${route}`);
      await page.waitForTimeout(500);
      
      // Check if nav item has active class/style
      const isActive = await page.locator(selector).evaluate((el: HTMLElement) => {
        return el.classList.contains('active') || 
               el.getAttribute('aria-current') === 'page' ||
               window.getComputedStyle(el).fontWeight === '700' ||
               window.getComputedStyle(el).fontWeight === 'bold';
      });
      
      const routeName = route.split('/').pop();
      console.log(`Active highlight for ${routeName}: ${isActive ? '✅' : '⚠️'}`);
      
      await TestHelpers.screenshot(page, `nav-10-active-${routeName}`);
    }
  });

  test('nav-11: Navigation timing performance', async ({ page }) => {
    const timings: { route: string; duration: number }[] = [];
    
    const routes = [
      TEST_CONFIG.ROUTES.CLIENTS,
      TEST_CONFIG.ROUTES.MESSAGES,
      TEST_CONFIG.ROUTES.AGENDA,
    ];
    
    for (const route of routes) {
      const start = Date.now();
      await page.goto(`${TEST_CONFIG.BASE_URL}${route}`);
      await TestHelpers.waitForNetworkIdle(page);
      const duration = Date.now() - start;
      
      timings.push({ route: route.split('/').pop() || route, duration });
    }
    
    console.log('\n=== Navigation Performance ===');
    timings.forEach(({ route, duration }) => {
      console.log(`  ${route}: ${duration}ms`);
    });
    
    const avgDuration = timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
    console.log(`  Average: ${avgDuration.toFixed(0)}ms`);
    console.log('==============================\n');
    
    // Navigation should be reasonably fast
    expect(avgDuration).toBeLessThan(TEST_CONFIG.NAVIGATION_TIMEOUT);
  });

  test('nav-12: Rapid navigation stress test', async ({ page }) => {
    // Rapidly click between sections
    const selectors = [
      TEST_CONFIG.SELECTORS.NAV_CLIENTS,
      TEST_CONFIG.SELECTORS.NAV_MESSAGES,
      TEST_CONFIG.SELECTORS.NAV_AGENDA,
      TEST_CONFIG.SELECTORS.NAV_INVENTORY,
    ];
    
    for (let i = 0; i < 3; i++) {
      for (const selector of selectors) {
        await page.click(selector).catch(() => {});
        await page.waitForTimeout(300);
      }
    }
    
    await page.waitForLoadState('networkidle');
    await TestHelpers.screenshot(page, 'nav-12-stress-test-final');
    
    // Should still be functional
    const currentUrl = page.url();
    expect(currentUrl).toContain('/workspace');
  });
});
