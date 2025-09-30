import { chromium } from '@playwright/test';

async function manualAuth() {
  console.log('\n🔐 Opening browser for manual authentication...');
  console.log('   📧 Email: jaydnmccutchen@gmail.com');
  console.log('   ⏰ You have 2 minutes to complete Google sign-in');
  console.log('   ✅ After reaching the dashboard, session will auto-save');
  console.log('\n   Browser opening...\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to production
  await page.goto('https://124f0c6f.brandvx-operator-ui.pages.dev/');

  // Wait for user to sign in (check for workspace URL)
  try {
    await page.waitForURL(/\/workspace|\/dashboard/, { timeout: 120000 });
    console.log('✅ Detected successful sign-in!');
    console.log('   Current URL:', page.url());
    
    // Wait a bit for everything to load
    await page.waitForTimeout(3000);

    // Save the authenticated state
    await context.storageState({ path: 'prod-auth-state.json' });
    console.log('💾 Auth state saved to prod-auth-state.json');
    console.log('\n🎯 Ready to run production tests!');

  } catch (error) {
    console.error('❌ Timeout waiting for sign-in');
    console.error('   Make sure you complete the sign-in process within 60 seconds');
  }

  await browser.close();
}

manualAuth();
