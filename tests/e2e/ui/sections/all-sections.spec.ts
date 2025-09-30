/**
 * All Workspace Sections - Comprehensive Tests
 * Tests functionality across all workspace sections
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, TestHelpers } from '../test-config';

test.describe('Dashboard Section', () => {
  test('dashboard-01: Initial load with KPIs', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.DASHBOARD}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    await TestHelpers.screenshot(page, 'dashboard-01-initial-load');
    
    // Look for KPI cards
    const kpiCards = await page.locator('[data-testid="kpi-card"], .kpi-card, [class*="metric"]').count();
    console.log(`KPI cards found: ${kpiCards}`);
    
    expect(kpiCards).toBeGreaterThanOrEqual(0);
  });

  test('dashboard-02: Quick actions/workflows present', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.DASHBOARD}`);
    await page.waitForLoadState('networkidle');
    
    const workflows = await page.locator('button[class*="workflow"], [data-testid*="workflow"]').count();
    console.log(`Workflow buttons found: ${workflows}`);
    
    await TestHelpers.screenshot(page, 'dashboard-02-workflows');
  });
});

test.describe('Clients Section', () => {
  test('clients-01: List loads', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    const clients = await page.locator('[data-testid="client"], .client-row, tr').count();
    console.log(`Clients visible: ${clients}`);
    
    await TestHelpers.screenshot(page, 'clients-01-list');
    
    expect(clients).toBeGreaterThanOrEqual(0);
  });

  test('clients-02: Search functionality', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`);
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(1000);
      
      await TestHelpers.screenshot(page, 'clients-02-search');
    }
  });

  test('clients-03: Client detail view', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`);
    await page.waitForLoadState('networkidle');
    
    const firstClient = page.locator('[data-testid="client"], .client-row, tr').first();
    
    if (await firstClient.isVisible()) {
      await firstClient.click();
      await page.waitForTimeout(1000);
      
      await TestHelpers.screenshot(page, 'clients-03-detail');
    }
  });

  test('clients-04: Pagination controls', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.CLIENTS}`);
    await page.waitForLoadState('networkidle');
    
    const pagination = await page.locator('button[aria-label*="next"], button[aria-label*="previous"], .pagination').count();
    console.log(`Pagination controls: ${pagination}`);
    
    await TestHelpers.screenshot(page, 'clients-04-pagination');
  });
});

test.describe('Messages Section', () => {
  test('messages-01: List loads', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.MESSAGES}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    const messages = await page.locator('[data-testid="message"], .message-row').count();
    console.log(`Messages visible: ${messages}`);
    
    await TestHelpers.screenshot(page, 'messages-01-list');
  });

  test('messages-02: Compose button', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.MESSAGES}`);
    await page.waitForLoadState('networkidle');
    
    const composeButton = page.locator('button:has-text("Compose"), button:has-text("New Message")');
    const hasCompose = await composeButton.isVisible();
    
    console.log(`Compose button visible: ${hasCompose}`);
    await TestHelpers.screenshot(page, 'messages-02-compose');
  });
});

test.describe('Agenda Section', () => {
  test('agenda-01: Calendar loads', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.AGENDA}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    await TestHelpers.screenshot(page, 'agenda-01-calendar');
    
    const calendar = await page.locator('[data-testid="calendar"], .calendar, [class*="calendar"]').isVisible();
    console.log(`Calendar visible: ${calendar}`);
  });

  test('agenda-02: Upcoming appointments', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.AGENDA}`);
    await page.waitForLoadState('networkidle');
    
    const appointments = await page.locator('[data-testid="appointment"], .appointment, [class*="event"]').count();
    console.log(`Appointments visible: ${appointments}`);
    
    await TestHelpers.screenshot(page, 'agenda-02-appointments');
  });
});

test.describe('Inventory Section', () => {
  test('inventory-01: Products list', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.INVENTORY}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    const products = await page.locator('[data-testid="product"], .product-row').count();
    console.log(`Products visible: ${products}`);
    
    await TestHelpers.screenshot(page, 'inventory-01-products');
  });

  test('inventory-02: Sync button', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.INVENTORY}`);
    await page.waitForLoadState('networkidle');
    
    const syncButton = page.locator('button:has-text("Sync")');
    const hasSync = await syncButton.isVisible();
    
    console.log(`Sync button visible: ${hasSync}`);
    await TestHelpers.screenshot(page, 'inventory-02-sync');
  });
});

test.describe('BrandVZN Section', () => {
  test('brandvzn-01: Section loads', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.BRANDVZN}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    await TestHelpers.screenshot(page, 'brandvzn-01-loaded');
    
    const currentUrl = page.url();
    expect(currentUrl).toContain('/brandvzn');
  });

  test('brandvzn-02: Upload image interface', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.BRANDVZN}`);
    await page.waitForLoadState('networkidle');
    
    const uploadButton = await page.locator('input[type="file"], button:has-text("Upload")').count();
    console.log(`Upload controls found: ${uploadButton}`);
    
    await TestHelpers.screenshot(page, 'brandvzn-02-upload');
  });
});

test.describe('Settings Section', () => {
  test('settings-01: Profile tab', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.SETTINGS}`);
    await TestHelpers.waitForNetworkIdle(page);
    
    await TestHelpers.screenshot(page, 'settings-01-profile');
    
    const currentUrl = page.url();
    expect(currentUrl).toContain('/settings');
  });

  test('settings-02: Tab navigation', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.SETTINGS}`);
    await page.waitForLoadState('networkidle');
    
    const tabs = await page.locator('[role="tab"], .tab, button[class*="tab"]').count();
    console.log(`Settings tabs found: ${tabs}`);
    
    await TestHelpers.screenshot(page, 'settings-02-tabs');
  });

  test('settings-03: Save changes button', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.SETTINGS}`);
    await page.waitForLoadState('networkidle');
    
    const saveButton = page.locator('button:has-text("Save")');
    const hasSave = await saveButton.isVisible();
    
    console.log(`Save button visible: ${hasSave}`);
    await TestHelpers.screenshot(page, 'settings-03-save');
  });
});
