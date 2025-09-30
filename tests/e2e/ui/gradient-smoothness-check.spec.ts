import { test } from '@playwright/test';

test('analyze gradient smoothness at critical transition points', async ({ page }) => {
  console.log('🔍 Analyzing gradient smoothness...\n');
  
  // Load landing page
  await page.goto('http://127.0.0.1:5175/');
  await page.evaluate(() => localStorage.setItem('bvx_landing_intro_shown', '1'));
  await page.goto('http://127.0.0.1:5175/');
  await page.waitForSelector('text=Book more clients', { timeout: 5000 });
  
  // Sample background colors at different vertical positions
  const samples = await page.evaluate(() => {
    const results: Array<{ y: number; description: string; color: string }> = [];
    const viewportHeight = window.innerHeight;
    
    // Sample at key points
    const points = [
      { percent: 20, label: 'Header area (20%)' },
      { percent: 35, label: 'Before "Automations" text (35%)' },
      { percent: 40, label: 'Around "Automations" text (40%)' },
      { percent: 45, label: 'After "Automations" text (45%)' },
      { percent: 50, label: 'Mid-page (50%)' },
      { percent: 60, label: 'Before cards (60%)' },
      { percent: 70, label: 'Card area (70%)' },
      { percent: 85, label: 'Lower page (85%)' },
    ];
    
    points.forEach(point => {
      const y = (viewportHeight * point.percent) / 100;
      const x = window.innerWidth / 2; // Center horizontal
      
      const el = document.elementFromPoint(x, y);
      if (el) {
        const style = window.getComputedStyle(el);
        const bgColor = style.backgroundColor;
        
        results.push({
          y: Math.round(y),
          description: point.label,
          color: bgColor
        });
      }
    });
    
    return results;
  });
  
  console.log('📊 Gradient color samples along page:\n');
  samples.forEach(sample => {
    console.log(`  ${sample.description.padEnd(35)} | Y: ${String(sample.y).padStart(4)}px | Color: ${sample.color}`);
  });
  
  console.log('\n✅ Analysis complete!');
  console.log('💡 If colors transition smoothly without abrupt jumps, gradient is working correctly.');
});
