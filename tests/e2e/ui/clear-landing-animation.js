const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5174/');
  
  // Clear the landing animation flag
  await page.evaluate(() => {
    localStorage.removeItem('bvx_landing_intro_shown');
  });
  
  console.log('✅ Landing animation flag cleared - you can test it again!');
  console.log('🔗 Visit: http://localhost:5174/');
  
  await browser.close();
})();
