/**
 * UI Test Suite Configuration
 * Shared constants and helpers for Playwright tests
 */

export const TEST_CONFIG = {
  // Base URLs
  BASE_URL: process.env.BASE_URL || 'https://brandvx.io',
  API_BASE_URL: process.env.API_BASE_URL || 'https://api.brandvx.io',
  
  // Test credentials
  TEST_EMAIL: process.env.TEST_USER_EMAIL || 'test@brandvx.test',
  TEST_PASSWORD: process.env.TEST_USER_PASSWORD || 'TestPassword123!',
  
  // Timeouts
  DEFAULT_TIMEOUT: 30000,
  NAVIGATION_TIMEOUT: 10000,
  API_TIMEOUT: 60000, // Longer for AI APIs
  SPLASH_TIMEOUT: 5000,
  
  // Viewports (per user's Mac laptop preference)
  VIEWPORT: {
    LAPTOP: { width: 1440, height: 900 },
    IPHONE: { width: 375, height: 667 },
    TABLET: { width: 768, height: 1024 },
  },
  
  // Routes
  ROUTES: {
    LANDING: '/',
    AUTH_CALLBACK: '/auth/callback',
    WORKSPACE: '/workspace',
    DASHBOARD: '/workspace',
    CLIENTS: '/workspace/clients',
    MESSAGES: '/workspace/messages',
    AGENDA: '/workspace/agenda',
    INVENTORY: '/workspace/inventory',
    BRANDVZN: '/workspace/brandvzn',
    SETTINGS: '/workspace/settings',
  },
  
  // Selectors
  SELECTORS: {
    // Auth
    SIGN_IN_BUTTON: 'button:has-text("Sign In")',
    EMAIL_INPUT: 'input[type="email"]',
    PASSWORD_INPUT: 'input[type="password"]',
    
    // Navigation
    NAV_DASHBOARD: '[data-nav="dashboard"], a[href="/workspace"]',
    NAV_CLIENTS: '[data-nav="clients"], a[href="/workspace/clients"]',
    NAV_MESSAGES: '[data-nav="messages"], a[href="/workspace/messages"]',
    NAV_AGENDA: '[data-nav="agenda"], a[href="/workspace/agenda"]',
    NAV_INVENTORY: '[data-nav="inventory"], a[href="/workspace/inventory"]',
    NAV_BRANDVZN: '[data-nav="brandvzn"], a[href="/workspace/brandvzn"]',
    NAV_SETTINGS: '[data-nav="settings"], a[href="/workspace/settings"]',
    
    // Ask VX
    ASKVX_DOCK: '[data-testid="askvx-dock"], .askvx-dock',
    ASKVX_INPUT: '[data-testid="askvx-input"], textarea[placeholder*="Ask"]',
    ASKVX_SEND: '[data-testid="askvx-send"]',
    
    // Splash
    SPLASH_OVERLAY: '[data-testid="splash"], .splash-overlay, #splash',
    
    // Common
    LOADING_SPINNER: '[data-testid="loading"], .loading, .spinner',
    ERROR_MESSAGE: '[data-testid="error"], .error-message',
  },
};

export interface ConsoleLog {
  timestamp: number;
  type: string;
  text: string;
}

export interface SplashEvent {
  timestamp: number;
  event: string;
  state?: any;
}

export class TestHelpers {
  /**
   * Extract splash-related console logs
   */
  static filterSplashLogs(logs: ConsoleLog[]): SplashEvent[] {
    return logs
      .filter(log => log.text.toLowerCase().includes('splash'))
      .map(log => ({
        timestamp: log.timestamp,
        event: log.text,
        state: this.extractSplashState(log.text),
      }));
  }
  
  /**
   * Extract splash state from log message
   */
  private static extractSplashState(logText: string): any {
    const match = logText.match(/\{([^}]+)\}/);
    if (match) {
      try {
        return JSON.parse(`{${match[1]}}`);
      } catch {
        return { raw: match[1] };
      }
    }
    return null;
  }
  
  /**
   * Count splash fires from logs
   */
  static countSplashFires(logs: SplashEvent[]): number {
    return logs.filter(log => 
      log.event.includes('enable') || 
      log.event.includes('show') ||
      log.event.includes('initializing')
    ).length;
  }
  
  /**
   * Wait for network idle
   */
  static async waitForNetworkIdle(page: any, timeout: number = 2000): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout });
  }
  
  /**
   * Check if element is interactable
   */
  static async isInteractable(page: any, selector: string): Promise<boolean> {
    try {
      const element = await page.locator(selector).first();
      const isVisible = await element.isVisible();
      const isEnabled = await element.isEnabled();
      const pointerEvents = await element.evaluate((el: HTMLElement) => 
        window.getComputedStyle(el).pointerEvents
      );
      
      return isVisible && isEnabled && pointerEvents !== 'none';
    } catch {
      return false;
    }
  }
  
  /**
   * Get sessionStorage value
   */
  static async getSessionStorage(page: any, key: string): Promise<string | null> {
    return await page.evaluate((k: string) => sessionStorage.getItem(k), key);
  }
  
  /**
   * Get all sessionStorage keys matching pattern
   */
  static async getSessionStorageKeys(page: any, pattern: string): Promise<string[]> {
    return await page.evaluate((p: string) => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.includes(p)) {
          keys.push(key);
        }
      }
      return keys;
    }, pattern);
  }
  
  /**
   * Measure page load time
   */
  static async measureLoadTime(page: any): Promise<number> {
    return await page.evaluate(() => {
      const perfData = window.performance.timing;
      return perfData.loadEventEnd - perfData.navigationStart;
    });
  }
  
  /**
   * Take screenshot with timestamp
   */
  static async screenshot(page: any, name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await page.screenshot({ 
      path: `tests/e2e/ui/screenshots/${name}-${timestamp}.png`,
      fullPage: true 
    });
  }
}
