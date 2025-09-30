import { test, expect } from '@playwright/test';

test.describe('Landing Page Gradient Diagnostic', () => {
  test('diagnose gradient break issue', async ({ page }) => {
    console.log('🎨 Loading landing page...');
    await page.goto('http://localhost:5174/');
    await page.waitForTimeout(2000);

    // Take full page screenshot
    await page.screenshot({ 
      path: 'tests/e2e/ui/screenshots/gradient-full-page.png',
      fullPage: true 
    });
    console.log('📸 Full page screenshot saved');

    // Get main container background
    const mainContainer = page.locator('div').first();
    const mainBg = await mainContainer.evaluate((el) => {
      return window.getComputedStyle(el).background;
    });
    console.log('\n📦 Main container background:');
    console.log(mainBg);

    // Get all section elements
    const sections = await page.locator('section').all();
    console.log(`\n📋 Found ${sections.length} section elements`);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const bbox = await section.boundingBox();
      const styles = await section.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          className: el.className,
          background: computed.background,
          backgroundColor: computed.backgroundColor,
          position: computed.position,
          zIndex: computed.zIndex,
        };
      });

      console.log(`\n--- Section ${i + 1} ---`);
      console.log(`Class: ${styles.className}`);
      console.log(`Position: ${styles.position}`);
      console.log(`Background: ${styles.background}`);
      console.log(`Background Color: ${styles.backgroundColor}`);
      console.log(`Z-Index: ${styles.zIndex}`);
      if (bbox) {
        console.log(`Location: y=${bbox.y}, height=${bbox.height}`);
      }

      // Take screenshot of each section
      if (bbox) {
        await page.screenshot({
          path: `tests/e2e/ui/screenshots/section-${i + 1}.png`,
          clip: {
            x: 0,
            y: bbox.y,
            width: 1440,
            height: Math.min(bbox.height, 500)
          }
        });
      }
    }

    // Check for any divs with background gradients
    const divsWithBg = await page.locator('div[style*="background"]').all();
    console.log(`\n🎨 Found ${divsWithBg.length} divs with inline background styles`);

    for (let i = 0; i < Math.min(divsWithBg.length, 5); i++) {
      const div = divsWithBg[i];
      const style = await div.getAttribute('style');
      const className = await div.getAttribute('class');
      console.log(`\nDiv ${i + 1}:`);
      console.log(`  Class: ${className}`);
      console.log(`  Style: ${style}`);
    }

    // Get the hero section specifically
    const heroSection = page.locator('section').first();
    const heroChildren = await heroSection.locator('> div').all();
    console.log(`\n🎯 Hero section has ${heroChildren.length} direct children`);

    for (let i = 0; i < heroChildren.length; i++) {
      const child = heroChildren[i];
      const styles = await child.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          className: el.className,
          background: computed.background,
          position: computed.position,
        };
      });
      console.log(`\n  Child ${i + 1}:`);
      console.log(`    Class: ${styles.className}`);
      console.log(`    Background: ${styles.background}`);
    }

    console.log('\n✅ Diagnostic complete - check screenshots/');
  });
});
