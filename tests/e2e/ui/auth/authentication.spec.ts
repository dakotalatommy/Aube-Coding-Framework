/**
 * Authentication Flow Tests
 * Tests all authentication scenarios including OAuth
 */

import { test, expect } from '@playwright/test';
import { TEST_CONFIG, TestHelpers } from '../test-config';

test.describe('Authentication Flows', () => {

  test('auth-01: Landing to sign-in modal', async ({ page }) => {
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.waitForLoadState('networkidle');
    
    await TestHelpers.screenshot(page, 'auth-01-landing');
    
    // Click sign-in button
    await page.click(TEST_CONFIG.SELECTORS.SIGN_IN_BUTTON);
    await page.waitForTimeout(1000);
    
    await TestHelpers.screenshot(page, 'auth-01-signin-modal');
    
    // Verify sign-in UI appears (modal or page)
    const hasEmailInput = await page.locator(TEST_CONFIG.SELECTORS.EMAIL_INPUT).isVisible().catch(() => false);
    const hasGoogleButton = await page.locator('button:has-text("Google")').isVisible().catch(() => false);
    
    console.log(`Email input visible: ${hasEmailInput}`);
    console.log(`Google button visible: ${hasGoogleButton}`);
    
    expect(hasEmailInput || hasGoogleButton).toBe(true);
  });

  test('auth-02: Google OAuth flow initiation', async ({ page }) => {
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.click(TEST_CONFIG.SELECTORS.SIGN_IN_BUTTON);
    await page.waitForTimeout(500);
    
    // Click Google sign-in (don't follow redirect)
    const [popup] = await Promise.all([
      page.waitForEvent('popup').catch(() => null),
      page.click('button:has-text("Google")').catch(() => {})
    ]);
    
    if (popup) {
      const popupUrl = popup.url();
      console.log(`OAuth popup opened: ${popupUrl}`);
      expect(popupUrl).toContain('accounts.google.com');
      await popup.close();
    } else {
      console.log('OAuth flow may be inline redirect');
    }
    
    await TestHelpers.screenshot(page, 'auth-02-google-oauth');
  });

  test('auth-03: Email sign-in flow', async ({ page }) => {
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.click(TEST_CONFIG.SELECTORS.SIGN_IN_BUTTON);
    await page.waitForTimeout(500);
    
    // Fill in test credentials
    const emailInput = page.locator(TEST_CONFIG.SELECTORS.EMAIL_INPUT);
    const passwordInput = page.locator(TEST_CONFIG.SELECTORS.PASSWORD_INPUT);
    
    if (await emailInput.isVisible()) {
      await emailInput.fill(TEST_CONFIG.TEST_EMAIL);
      await passwordInput.fill(TEST_CONFIG.TEST_PASSWORD);
      
      await TestHelpers.screenshot(page, 'auth-03-credentials-filled');
      
      // Submit form
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);
      
      await TestHelpers.screenshot(page, 'auth-03-after-submit');
      
      // Check if redirected or error shown
      const currentUrl = page.url();
      console.log(`After sign-in URL: ${currentUrl}`);
    } else {
      console.log('Email input not found - may be modal-based');
    }
  });

  test('auth-04: Auth callback redirect', async ({ page }) => {
    // Simulate successful OAuth callback
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.AUTH_CALLBACK}?code=test`);
    await page.waitForTimeout(3000);
    
    const finalUrl = page.url();
    console.log(`Auth callback final URL: ${finalUrl}`);
    
    await TestHelpers.screenshot(page, 'auth-04-callback-redirect');
    
    // Should redirect to workspace or landing
    expect(finalUrl).toMatch(/\/(workspace|$)/);
  });

  test('auth-05: Session persistence on refresh', async ({ page }) => {
    // Navigate to workspace (may require auth)
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    const beforeUrl = page.url();
    
    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const afterUrl = page.url();
    
    console.log(`Before refresh: ${beforeUrl}`);
    console.log(`After refresh: ${afterUrl}`);
    
    await TestHelpers.screenshot(page, 'auth-05-after-refresh');
    
    // If was at workspace, should stay at workspace
    if (beforeUrl.includes('/workspace')) {
      expect(afterUrl).toContain('/workspace');
    }
  });

  test('auth-06: Token in storage', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    // Check for Supabase auth tokens
    const hasAuthToken = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.some(k => k.includes('supabase') && k.includes('auth'));
    });
    
    console.log(`Supabase auth token present: ${hasAuthToken}`);
    
    if (hasAuthToken) {
      const tokenData = await page.evaluate(() => {
        const keys = Object.keys(localStorage);
        const authKey = keys.find(k => k.includes('supabase') && k.includes('auth'));
        return authKey ? localStorage.getItem(authKey) : null;
      });
      
      if (tokenData) {
        try {
          const parsed = JSON.parse(tokenData);
          console.log(`Token has user: ${!!parsed.user}`);
          console.log(`Token has access_token: ${!!parsed.access_token}`);
        } catch (e) {
          console.log('Token data not JSON');
        }
      }
    }
    
    await TestHelpers.screenshot(page, 'auth-06-token-check');
  });

  test('auth-07: Invalid credentials error handling', async ({ page }) => {
    await page.goto(TEST_CONFIG.BASE_URL);
    await page.click(TEST_CONFIG.SELECTORS.SIGN_IN_BUTTON);
    await page.waitForTimeout(500);
    
    const emailInput = page.locator(TEST_CONFIG.SELECTORS.EMAIL_INPUT);
    
    if (await emailInput.isVisible()) {
      await emailInput.fill('invalid@test.com');
      await page.locator(TEST_CONFIG.SELECTORS.PASSWORD_INPUT).fill('wrongpassword');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(2000);
      
      // Look for error message
      const hasError = await page.locator(TEST_CONFIG.SELECTORS.ERROR_MESSAGE).isVisible().catch(() => false);
      
      console.log(`Error message shown: ${hasError}`);
      
      await TestHelpers.screenshot(page, 'auth-07-invalid-credentials');
    }
  });

  test('auth-08: Logout flow', async ({ page }) => {
    await page.goto(`${TEST_CONFIG.BASE_URL}${TEST_CONFIG.ROUTES.WORKSPACE}`);
    await page.waitForLoadState('networkidle');
    
    // Look for sign-out button (usually in settings or profile menu)
    const signOutButton = page.locator('button:has-text("Sign Out"), button:has-text("Log Out"), a:has-text("Sign Out")');
    
    if (await signOutButton.isVisible()) {
      await signOutButton.click();
      await page.waitForTimeout(2000);
      
      const afterLogoutUrl = page.url();
      console.log(`After logout URL: ${afterLogoutUrl}`);
      
      await TestHelpers.screenshot(page, 'auth-08-after-logout');
      
      // Should redirect to landing
      expect(afterLogoutUrl).not.toContain('/workspace');
    } else {
      console.log('Sign out button not found in current view');
    }
  });
});
