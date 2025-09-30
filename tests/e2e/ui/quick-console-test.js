const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Capture all console messages
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]:`, msg.text());
  });
  
  // Clear localStorage
  await page.goto('http://localhost:5174/');
  await page.evaluate(() => localStorage.clear());
  
  console.log('\n=== Reloading page ===\n');
  
  // Reload to test animation
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(3000);
  
  // Check for video element
  const videoCount = await page.locator('video').count();
  console.log('\n=== Video element count:', videoCount, '===\n');
  
  await browser.close();
})();
