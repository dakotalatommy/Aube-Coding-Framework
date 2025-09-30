import { chromium, FullConfig } from '@playwright/test';

const TEST_USER_EMAIL = 'playwright-test@brandvx.test';
const TEST_USER_PASSWORD = 'PlaywrightTest123!@#';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  console.log('\n🔐 Authenticating test user...');
  console.log('   URL:', baseURL);
  console.log('   Email:', TEST_USER_EMAIL);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to landing first
    await page.goto(`${baseURL}/`);
    await page.waitForTimeout(6000); // Wait for landing animation to complete
    
    // Click sign in button
    const signInButton = await page.locator('button:has-text("Sign in"), a:has-text("Sign in")').first();
    await signInButton.click();
    await page.waitForTimeout(2000);

    // Fill in credentials
    console.log('   Filling email...');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', TEST_USER_EMAIL);
    await page.waitForTimeout(500);

    console.log('   Filling password...');
    await page.waitForSelector('input[type="password"], input[name="password"]', { timeout: 10000 });
    await page.fill('input[type="password"]', TEST_USER_PASSWORD);
    await page.waitForTimeout(500);

    // Submit
    console.log('   Submitting...');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to workspace
    console.log('   Waiting for workspace...');
    await page.waitForURL(/\/workspace|\/dashboard/, { timeout: 30000 });
    
    console.log('✅ Authentication successful!');
    console.log('   Current URL:', page.url());

    // Save authentication state
    await context.storageState({ path: 'auth-state.json' });
    console.log('💾 Auth state saved to auth-state.json');

  } catch (error) {
    console.error('❌ Authentication failed:', error);
    await page.screenshot({ path: 'auth-failure.png' });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
