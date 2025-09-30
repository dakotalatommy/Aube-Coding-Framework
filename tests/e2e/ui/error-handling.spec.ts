/**
 * Error Handling & Edge Cases
 * Tests error states, network failures, and edge cases
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, TestHelpers } from './test-config';

test.describe('Error Handling', () => {

  test('error-01: Network failure graceful handling', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    // Simulate offline
    await page.context().setOffline(true);
    
    // Try to navigate
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`).catch(() => {});
    await page.waitForTimeout(2000);
    
    await TestHelpers.screenshot(page, 'error-01-offline');
    
    // Restore network
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);
    
    console.log('Network failure test completed');
  });

  test('error-02: 500 error handling', async ({ page }) => {
    // Intercept and mock 500 error
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });
    
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForTimeout(2000);
    
    // Look for error UI
    const errorVisible = await page.locator(TEST_CONFIG.SELECTORS.ERROR_MESSAGE).isVisible().catch(() => false);
    console.log(`Error message shown: ${errorVisible}`);
    
    await TestHelpers.screenshot(page, 'error-02-500-error');
  });

  test('error-03: 404 page', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}/nonexistent-page`);
    await page.waitForTimeout(1000);
    
    const pageContent = await page.content();
    const has404 = pageContent.toLowerCase().includes('404') || 
                   pageContent.toLowerCase().includes('not found');
    
    console.log(`404 page shown: ${has404}`);
    await TestHelpers.screenshot(page, 'error-03-404-page');
  });

  test('error-04: Session expired redirect', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    // Clear session
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Try to access protected route
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`);
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    console.log(`After session clear URL: ${currentUrl}`);
    
    await TestHelpers.screenshot(page, 'error-04-session-expired');
  });

  test('error-05: API timeout handling', async ({ page }) => {
    // Slow down API responses
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000));
      route.continue();
    });
    
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForTimeout(3000);
    
    // Check for loading state
    const loadingVisible = await page.locator(TEST_CONFIG.SELECTORS.LOADING_SPINNER).isVisible().catch(() => false);
    console.log(`Loading indicator shown: ${loadingVisible}`);
    
    await TestHelpers.screenshot(page, 'error-05-timeout');
  });
});

test.describe('Viewport & Responsive Tests', () => {
  
  test('viewport-01: Laptop viewport (1440x900)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    await TestHelpers.screenshot(page, 'viewport-01-laptop');
    
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(1440);
  });

  test('viewport-02: iPhone viewport (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    await TestHelpers.screenshot(page, 'viewport-02-iphone');
    
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(375);
  });

  test('viewport-03: Tablet viewport (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    await TestHelpers.screenshot(page, 'viewport-03-tablet');
    
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(768);
  });

  test('viewport-04: No horizontal scroll', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    console.log(`Has horizontal scroll: ${hasHorizontalScroll}`);
    await TestHelpers.screenshot(page, 'viewport-04-no-h-scroll');
    
    expect(hasHorizontalScroll).toBe(false);
  });

  test('viewport-05: No vertical scroll (calc 100vh - AskVX)', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    const scrollInfo = await page.evaluate(() => {
      return {
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
        hasScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight,
      };
    });
    
    console.log(`Vertical scroll check:`);
    console.log(`  Scroll height: ${scrollInfo.scrollHeight}px`);
    console.log(`  Client height: ${scrollInfo.clientHeight}px`);
    console.log(`  Has scroll: ${scrollInfo.hasScroll}`);
    
    await TestHelpers.screenshot(page, 'viewport-05-no-v-scroll');
    
    // Per design: should not scroll
    expect(scrollInfo.hasScroll).toBe(false);
  });
});
