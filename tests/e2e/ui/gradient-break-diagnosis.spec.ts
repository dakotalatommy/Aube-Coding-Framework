import { test } from '@playwright/test';

test('diagnose gradient break - wait for real content', async ({ page }) => {
  console.log('🎨 Loading landing page and waiting for content...');
  
  // Navigate and wait for the actual landing page text
  await page.goto('http://localhost:5174/');
  
  // Wait for the landing page content to appear (not just animation)
  await page.waitForSelector('text=Book more clients', { timeout: 15000 });
  await page.waitForTimeout(1000);
  
  console.log('✅ Landing page content loaded');

  // Take full screenshot
  await page.screenshot({ 
    path: 'tests/e2e/ui/screenshots/gradient-break-full.png',
    fullPage: true 
  });

  // Find the main container with the gradient
  const mainContainer = page.locator('div.relative.w-full.min-h-\\[100dvh\\]').first();
  const mainBg = await mainContainer.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      background: style.background,
      backgroundImage: style.backgroundImage,
    };
  });
  
  console.log('\n📦 Main container background:');
  console.log('Full:', mainBg.background);
  console.log('\nImage:', mainBg.backgroundImage);

  // Get hero section
  const heroSection = page.locator('section').first();
  const heroBbox = await heroSection.boundingBox();
  const heroStyles = await heroSection.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      background: style.background,
      backgroundColor: style.backgroundColor,
      paddingBottom: style.paddingBottom,
    };
  });

  console.log('\n🎯 Hero section:');
  console.log('Background:', heroStyles.background);
  console.log('BG Color:', heroStyles.backgroundColor);
  console.log('Padding Bottom:', heroStyles.paddingBottom);
  if (heroBbox) {
    console.log('Bottom edge at:', heroBbox.y + heroBbox.height);
  }

  // Get CTA section (the one right after hero)
  const ctaSection = page.locator('section').nth(1);
  const ctaBbox = await ctaSection.boundingBox();
  const ctaStyles = await ctaSection.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      background: style.background,
      backgroundColor: style.backgroundColor,
      paddingTop: style.paddingTop,
      paddingBottom: style.paddingBottom,
    };
  });

  console.log('\n🔘 CTA section:');
  console.log('Background:', ctaStyles.background);
  console.log('BG Color:', ctaStyles.backgroundColor);
  console.log('Padding Top:', ctaStyles.paddingTop);
  console.log('Padding Bottom:', ctaStyles.paddingBottom);
  if (ctaBbox) {
    console.log('Top edge at:', ctaBbox.y);
    console.log('Bottom edge at:', ctaBbox.y + ctaBbox.height);
  }

  // Check for gap between hero and CTA
  if (heroBbox && ctaBbox) {
    const gap = ctaBbox.y - (heroBbox.y + heroBbox.height);
    console.log(`\n⚠️  GAP between hero and CTA: ${gap}px`);
  }

  // Get WorkflowRow section
  const workflowSection = page.locator('section').nth(2);
  const workflowBbox = await workflowSection.boundingBox();
  
  if (workflowBbox && ctaBbox) {
    const gap = workflowBbox.y - (ctaBbox.y + ctaBbox.height);
    console.log(`⚠️  GAP between CTA and cards: ${gap}px`);
  }

  // Take screenshot of the specific area where break appears
  if (heroBbox && ctaBbox) {
    await page.screenshot({
      path: 'tests/e2e/ui/screenshots/gradient-break-area.png',
      clip: {
        x: 0,
        y: heroBbox.y + heroBbox.height - 100,
        width: 1440,
        height: 300
      }
    });
    console.log('\n📸 Screenshot of break area saved');
  }

  console.log('\n✅ Diagnosis complete');
});
