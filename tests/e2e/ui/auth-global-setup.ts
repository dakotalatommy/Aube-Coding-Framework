import { chromium, FullConfig } from '@playwright/test';

const TEST_USER_EMAIL = 'playwright-test@brandvx.test';
const TEST_USER_PASSWORD = 'PlaywrightTest123!@#';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  console.log('\n🔐 Setting up authenticated session...');
  console.log('   URL:', baseURL);
  console.log('   Email:', TEST_USER_EMAIL);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go directly to login page (bypass landing animation)
    await page.goto(`${baseURL}/login`);
    await page.waitForTimeout(3000);

    // Fill credentials
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', TEST_USER_EMAIL);
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });
    await page.fill('input[type="password"]', TEST_USER_PASSWORD);
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Wait for workspace
    await page.waitForURL(/\/workspace/, { timeout: 15000 });
    
    console.log('✅ Authentication successful!');
    
    // Save auth state
    await context.storageState({ path: 'auth-state.json' });
    console.log('💾 Auth state saved\n');

  } catch (error) {
    console.error('❌ Auth setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
