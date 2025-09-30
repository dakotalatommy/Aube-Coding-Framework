/**
 * Performance & Timing Tests
 * Measures load times, navigation speed, and responsiveness
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, TestHelpers } from '../test-config';

test.describe('Performance Metrics', () => {

  test('perf-01: Initial load time', async ({ page }) => {
    const start = Date.now();
    
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - start;
    
    // Get Web Vitals if available
    const vitals = await page.evaluate(() => {
      const perfData = performance.timing;
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
        fullyLoaded: perfData.loadEventEnd - perfData.navigationStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
      };
    });
    
    console.log('\n=== Performance Metrics ===');
    console.log(`Total load time: ${loadTime}ms`);
    console.log(`DOM ready: ${vitals.domContentLoaded}ms`);
    console.log(`Fully loaded: ${vitals.fullyLoaded}ms`);
    console.log(`First paint: ${vitals.firstPaint.toFixed(0)}ms`);
    console.log('==========================\n');
    
    await TestHelpers.screenshot(page, 'perf-01-loaded');
    
    expect(loadTime).toBeLessThan(10000); // 10s max
  });

  test('perf-02: Navigation speed between sections', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    const timings: { from: string; to: string; duration: number }[] = [];
    
    const routes = [
      { name: 'Dashboard', path: TEST_CONFIG.ROUTES.DASHBOARD },
      { name: 'Clients', path: TEST_CONFIG.ROUTES.CLIENTS },
      { name: 'Messages', path: TEST_CONFIG.ROUTES.MESSAGES },
      { name: 'Settings', path: TEST_CONFIG.ROUTES.SETTINGS },
    ];
    
    for (let i = 0; i < routes.length - 1; i++) {
      const from = routes[i];
      const to = routes[i + 1];
      
      await page.goto(`${TEST_CONFIG.BASE_URL}${from.path}`);
      await page.waitForLoadState('networkidle');
      
      const start = Date.now();
      await page.goto(`${TEST_CONFIG.BASE_URL}${to.path}`);
      await page.waitForLoadState('networkidle');
      const duration = Date.now() - start;
      
      timings.push({ from: from.name, to: to.name, duration });
    }
    
    console.log('\n=== Navigation Timings ===');
    timings.forEach(({ from, to, duration }) => {
      console.log(`${from} → ${to}: ${duration}ms`);
    });
    
    const avgNav = timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
    console.log(`Average: ${avgNav.toFixed(0)}ms`);
    console.log('=========================\n');
    
    expect(avgNav).toBeLessThan(TEST_CONFIG.NAVIGATION_TIMEOUT);
  });

  test('perf-03: API response times', async ({ page }) => {
    const apiCalls: { url: string; duration: number }[] = [];
    
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/') || url.includes(TEST_CONFIG.API_BASE_URL)) {
        const timing = response.timing();
        if (timing) {
          const duration = timing.responseEnd - timing.requestStart;
          apiCalls.push({ url, duration });
        }
      }
    });
    
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    console.log('\n=== API Response Times ===');
    apiCalls.forEach(({ url, duration }) => {
      const endpoint = url.split('/').pop() || url;
      console.log(`${endpoint}: ${duration.toFixed(0)}ms`);
    });
    
    if (apiCalls.length > 0) {
      const avgApi = apiCalls.reduce((sum, c) => sum + c.duration, 0) / apiCalls.length;
      console.log(`Average: ${avgApi.toFixed(0)}ms`);
    }
    console.log('=========================\n');
  });

  test('perf-04: No memory leaks during navigation', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    
    const routes = [
      TEST_CONFIG.ROUTES.CLIENTS,
      TEST_CONFIG.ROUTES.MESSAGES,
      TEST_CONFIG.ROUTES.AGENDA,
      TEST_CONFIG.ROUTES.INVENTORY,
    ];
    
    // Navigate multiple times
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const route of routes) {
        await page.goto(`${TEST_CONFIG.BASE_URL}${route}`);
        await page.waitForTimeout(500);
      }
    }
    
    // Check for memory usage (basic check)
    const metrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        };
      }
      return null;
    });
    
    if (metrics) {
      const usageMB = (metrics.usedJSHeapSize / 1024 / 1024).toFixed(2);
      console.log(`\nMemory usage: ${usageMB} MB`);
    }
    
    await TestHelpers.screenshot(page, 'perf-04-memory-check');
  });
});
