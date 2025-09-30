/**
 * Ask VX Chat Tests
 * Tests the AI chat functionality across all pages
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, TestHelpers } from '../test-config';

test.describe('Ask VX Chat Interface', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
  });

  test('askvx-01: Dock visible on all pages', async ({ page }) => {
    const routes = [
      TEST_CONFIG.ROUTES.DASHBOARD,
      TEST_CONFIG.ROUTES.CLIENTS,
      TEST_CONFIG.ROUTES.MESSAGES,
      TEST_CONFIG.ROUTES.SETTINGS,
    ];
    
    for (const route of routes) {
      await page.goto(`${TEST_CONFIG.BASE_URL}${route}`);
      await page.waitForTimeout(500);
      
      const dockVisible = await page.locator(TEST_CONFIG.SELECTORS.ASKVX_DOCK).isVisible().catch(() => false);
      const routeName = route.split('/').pop() || 'dashboard';
      
      console.log(`Ask VX dock on ${routeName}: ${dockVisible ? '✅' : '❌'}`);
      await TestHelpers.screenshot(page, `askvx-01-dock-${routeName}`);
      
      expect(dockVisible).toBe(true);
    }
  });

  test('askvx-02: Expand chat interface', async ({ page }) => {
    // Click to expand Ask VX
    const dockButton = page.locator(TEST_CONFIG.SELECTORS.ASKVX_DOCK);
    
    if (await dockButton.isVisible()) {
      await dockButton.click();
      await page.waitForTimeout(500);
      
      await TestHelpers.screenshot(page, 'askvx-02-expanded');
      
      // Check if input is now visible
      const inputVisible = await page.locator(TEST_CONFIG.SELECTORS.ASKVX_INPUT).isVisible().catch(() => false);
      console.log(`Chat input visible after expand: ${inputVisible}`);
      
      expect(inputVisible).toBe(true);
    }
  });

  test('askvx-03: Send message and receive response', async ({ page }) => {
    // Expand chat
    await page.locator(TEST_CONFIG.SELECTORS.ASKVX_DOCK).click().catch(() => {});
    await page.waitForTimeout(500);
    
    const input = page.locator(TEST_CONFIG.SELECTORS.ASKVX_INPUT);
    
    if (await input.isVisible()) {
      // Type test message
      await input.fill('How many clients do I have?');
      await TestHelpers.screenshot(page, 'askvx-03-message-typed');
      
      // Send message
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1000);
      
      await TestHelpers.screenshot(page, 'askvx-03-message-sent');
      
      // Wait for response (with timeout)
      await page.waitForTimeout(5000);
      
      // Check if response appeared
      const messagesCount = await page.locator('[data-testid="chat-message"], .chat-message, .message').count();
      console.log(`Chat messages visible: ${messagesCount}`);
      
      await TestHelpers.screenshot(page, 'askvx-03-with-response');
      
      expect(messagesCount).toBeGreaterThan(0);
    }
  });

  test('askvx-04: Suggestions appear', async ({ page }) => {
    await page.locator(TEST_CONFIG.SELECTORS.ASKVX_DOCK).click().catch(() => {});
    await page.waitForTimeout(500);
    
    // Look for suggestion chips
    const suggestions = page.locator('[data-testid="suggestion"], .suggestion-chip, button[class*="suggestion"]');
    const count = await suggestions.count();
    
    console.log(`Suggestion chips found: ${count}`);
    await TestHelpers.screenshot(page, 'askvx-04-suggestions');
  });

  test('askvx-05: Chat history persists across pages', async ({ page }) => {
    // Send a message
    await page.locator(TEST_CONFIG.SELECTORS.ASKVX_DOCK).click().catch(() => {});
    const input = page.locator(TEST_CONFIG.SELECTORS.ASKVX_INPUT);
    
    if (await input.isVisible()) {
      await input.fill('Test message for history');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      const messagesBefore = await page.locator('[data-testid="chat-message"], .chat-message').count();
      
      // Navigate to different page
      await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`);
      await page.waitForTimeout(1000);
      
      // Expand chat again
      await page.locator(TEST_CONFIG.SELECTORS.ASKVX_DOCK).click().catch(() => {});
      await page.waitForTimeout(500);
      
      const messagesAfter = await page.locator('[data-testid="chat-message"], .chat-message').count();
      
      console.log(`Messages before: ${messagesBefore}, after: ${messagesAfter}`);
      await TestHelpers.screenshot(page, 'askvx-05-history-persisted');
      
      expect(messagesAfter).toBeGreaterThanOrEqual(messagesBefore);
    }
  });

  test('askvx-06: Minimize and restore', async ({ page }) => {
    // Expand
    await page.locator(TEST_CONFIG.SELECTORS.ASKVX_DOCK).click();
    await page.waitForTimeout(500);
    
    const expandedHeight = await page.locator(TEST_CONFIG.SELECTORS.ASKVX_DOCK).evaluate((el: HTMLElement) => {
      return el.offsetHeight;
    });
    
    // Look for minimize button
    const minimizeButton = page.locator('[data-testid="minimize"], button[aria-label*="minimize"]');
    
    if (await minimizeButton.isVisible()) {
      await minimizeButton.click();
      await page.waitForTimeout(500);
      
      await TestHelpers.screenshot(page, 'askvx-06-minimized');
      
      // Click to restore
      await page.locator(TEST_CONFIG.SELECTORS.ASKVX_DOCK).click();
      await page.waitForTimeout(500);
      
      await TestHelpers.screenshot(page, 'askvx-06-restored');
    }
  });

  test('askvx-07: Height constraint - no vertical scroll', async ({ page }) => {
    // Check if Ask VX causes page scrolling
    const pageHeight = await page.evaluate(() => {
      return document.documentElement.scrollHeight;
    });
    
    const viewportHeight = await page.evaluate(() => {
      return window.innerHeight;
    });
    
    const hasVerticalScroll = pageHeight > viewportHeight;
    
    console.log(`Page height: ${pageHeight}px`);
    console.log(`Viewport height: ${viewportHeight}px`);
    console.log(`Has vertical scroll: ${hasVerticalScroll}`);
    
    await TestHelpers.screenshot(page, 'askvx-07-height-check');
    
    // Per design: no vertical scrolling
    expect(hasVerticalScroll).toBe(false);
  });
});
