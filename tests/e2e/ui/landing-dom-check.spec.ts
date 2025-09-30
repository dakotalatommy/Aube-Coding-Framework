import { test } from '@playwright/test';

test('check what actually renders', async ({ page }) => {
  console.log('Loading page...');
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(3000);

  // Get page title
  const title = await page.title();
  console.log(`Page title: ${title}`);

  // Get all divs
  const allDivs = await page.locator('div').count();
  console.log(`Total div elements: ${allDivs}`);

  // Get body HTML  
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  console.log('\n📄 Body HTML (first 2000 chars):');
  console.log(bodyHTML.substring(0, 2000));

  // Check for specific text
  const hasBookText = await page.locator('text=Book more clients').count();
  console.log(`\n"Book more clients" found: ${hasBookText}`);

  // Get all elements with style attribute
  const styledElements = await page.locator('[style]').all();
  console.log(`\nElements with style attribute: ${styledElements.length}`);
  
  for (let i = 0; i < Math.min(styledElements.length, 3); i++) {
    const tagName = await styledElements[i].evaluate(el => el.tagName);
    const style = await styledElements[i].getAttribute('style');
    console.log(`${tagName}: ${style?.substring(0, 200)}`);
  }

  await page.screenshot({ path: 'tests/e2e/ui/screenshots/dom-check.png', fullPage: true });
  console.log('\n✅ Screenshot saved');
});
