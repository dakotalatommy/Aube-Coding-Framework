import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('White Screen Diagnostic', () => {
  test('diagnose bootstrap and page load issues', async ({ page }) => {
    const consoleLogs: Array<{ type: string; text: string; timestamp: number }> = [];
    const networkRequests: Array<{ url: string; method: string; status: number | null; timing: number }> = [];
    const errors: string[] = [];
    const startTime = Date.now();

    // Capture all console messages
    page.on('console', (msg) => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now() - startTime,
      };
      consoleLogs.push(logEntry);
      console.log(`[${logEntry.timestamp}ms] [${logEntry.type}] ${logEntry.text}`);
    });

    // Capture all network requests
    page.on('request', (request) => {
      const requestData = {
        url: request.url(),
        method: request.method(),
        status: null as number | null,
        timing: Date.now() - startTime,
      };
      networkRequests.push(requestData);
      console.log(`[${requestData.timing}ms] → ${requestData.method} ${requestData.url}`);
    });

    page.on('response', (response) => {
      const request = networkRequests.find((r) => r.url === response.url() && r.status === null);
      if (request) {
        request.status = response.status();
        console.log(`[${Date.now() - startTime}ms] ← ${request.status} ${request.url}`);
      }
    });

    // Capture JavaScript errors
    page.on('pageerror', (error) => {
      const errorMsg = error.message;
      errors.push(errorMsg);
      console.error(`[${Date.now() - startTime}ms] PAGE ERROR:`, errorMsg);
    });

    // Load the auth state if available
    const authStatePath = path.join(__dirname, '../auth-state.json');
    if (fs.existsSync(authStatePath)) {
      await page.context().addCookies(JSON.parse(fs.readFileSync(authStatePath, 'utf-8')).cookies || []);
      console.log('✓ Loaded auth state');
    } else {
      console.log('⚠ No auth state found - will test as unauthenticated user');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 STARTING PAGE LOAD DIAGNOSTIC');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Navigate to the app
    await page.goto('https://app.brandvx.io', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait a bit to let bootstrap attempt to run
    console.log('\n⏳ Waiting 10 seconds for bootstrap to complete...\n');
    await page.waitForTimeout(10000);

    // Check page state
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PAGE STATE ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check if page is blank/white
    const bodyHTML = await page.evaluate(() => document.body.innerHTML);
    const isBlank = bodyHTML.trim() === '' || bodyHTML.trim() === '<div id="root"></div>';
    
    console.log('Page State:', isBlank ? '❌ BLANK/WHITE SCREEN' : '✓ Content rendered');
    console.log('Body HTML length:', bodyHTML.length, 'characters');

    // Check for React root
    const hasReactRoot = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    });
    console.log('React root populated:', hasReactRoot ? '✓ Yes' : '❌ No');

    // Check for specific UI elements
    const hasDashboard = await page.locator('[data-page="dashboard"]').count();
    const hasLanding = await page.locator('text=/sign in|create account/i').count();
    const hasSplash = await page.locator('text=/loading|brandvx/i').count();

    console.log('Dashboard visible:', hasDashboard > 0 ? '✓ Yes' : '❌ No');
    console.log('Landing page visible:', hasLanding > 0 ? '✓ Yes' : '❌ No');
    console.log('Splash/Loading visible:', hasSplash > 0 ? '✓ Yes' : '❌ No');

    // Check localStorage
    const localStorage = await page.evaluate(() => {
      const data: Record<string, string | null> = {};
      data.bvx_tenant = localStorage.getItem('bvx_tenant');
      data.bvx_intro_complete = localStorage.getItem('bvx_intro_complete');
      return data;
    });
    console.log('\nLocalStorage:');
    console.log('  bvx_tenant:', localStorage.bvx_tenant || 'null');
    console.log('  bvx_intro_complete:', localStorage.bvx_intro_complete || 'null');

    // Analyze console logs
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 CONSOLE LOG ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Total console messages: ${consoleLogs.length}`);
    
    const bvxAuthLogs = consoleLogs.filter((log) => log.text.includes('[bvx:auth]'));
    const bvxApiLogs = consoleLogs.filter((log) => log.text.includes('[bvx:api]'));
    const errorLogs = consoleLogs.filter((log) => log.type === 'error');
    const warnLogs = consoleLogs.filter((log) => log.type === 'warning');

    console.log(`[bvx:auth] logs: ${bvxAuthLogs.length}`);
    bvxAuthLogs.forEach((log) => {
      console.log(`  [${log.timestamp}ms] ${log.text}`);
    });

    console.log(`\n[bvx:api] logs: ${bvxApiLogs.length}`);
    bvxApiLogs.forEach((log) => {
      console.log(`  [${log.timestamp}ms] ${log.text}`);
    });

    if (errorLogs.length > 0) {
      console.log(`\n❌ Error logs: ${errorLogs.length}`);
      errorLogs.forEach((log) => {
        console.log(`  [${log.timestamp}ms] ${log.text}`);
      });
    }

    if (warnLogs.length > 0) {
      console.log(`\n⚠ Warning logs: ${warnLogs.length}`);
      warnLogs.forEach((log) => {
        console.log(`  [${log.timestamp}ms] ${log.text}`);
      });
    }

    // Analyze network requests
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 NETWORK REQUEST ANALYSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Total network requests: ${networkRequests.length}`);

    const apiRequests = networkRequests.filter((r) => r.url.includes('api.brandvx.io'));
    const supabaseRequests = networkRequests.filter((r) => r.url.includes('supabase.co'));
    const staticRequests = networkRequests.filter((r) => 
      r.url.includes('.js') || r.url.includes('.css') || r.url.includes('.woff')
    );

    console.log(`\nAPI requests (api.brandvx.io): ${apiRequests.length}`);
    apiRequests.forEach((req) => {
      console.log(`  [${req.timing}ms] ${req.method} ${req.url.replace('https://api.brandvx.io', '')} → ${req.status || 'pending'}`);
    });

    console.log(`\nSupabase requests: ${supabaseRequests.length}`);
    supabaseRequests.forEach((req) => {
      const shortUrl = req.url.replace(/https:\/\/[^.]+\.supabase\.co/, '[supabase]');
      console.log(`  [${req.timing}ms] ${req.method} ${shortUrl} → ${req.status || 'pending'}`);
    });

    console.log(`\nStatic resources: ${staticRequests.length}`);

    // Key diagnostic checks
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 KEY DIAGNOSTIC RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const hasSessionCreatedLog = consoleLogs.some((log) => log.text.includes('[bvx:auth] session created'));
    const hasMeResponseLog = consoleLogs.some((log) => log.text.includes('[bvx:auth] /me response'));
    const hasBootstrapCompleteLog = consoleLogs.some((log) => log.text.includes('[bvx:auth] bootstrap completed'));
    const hasMeRequest = apiRequests.some((req) => req.url.includes('/me'));
    const hasSettingsRequest = apiRequests.some((req) => req.url.includes('/settings'));

    console.log('✓ = Present | ❌ = Missing\n');
    console.log(`${hasSessionCreatedLog ? '✓' : '❌'} Console: [bvx:auth] session created`);
    console.log(`${hasMeResponseLog ? '✓' : '❌'} Console: [bvx:auth] /me response`);
    console.log(`${hasBootstrapCompleteLog ? '✓' : '❌'} Console: [bvx:auth] bootstrap completed`);
    console.log(`${hasMeRequest ? '✓' : '❌'} Network: GET /me request`);
    console.log(`${hasSettingsRequest ? '✓' : '❌'} Network: GET /settings request`);
    console.log(`${hasReactRoot ? '✓' : '❌'} UI: React content rendered`);
    console.log(`${!isBlank ? '✓' : '❌'} UI: Page has content (not white screen)`);

    // Diagnosis
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 DIAGNOSIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (isBlank) {
      console.log('🔴 WHITE SCREEN DETECTED\n');
      
      if (hasSessionCreatedLog && !hasMeRequest) {
        console.log('Issue: Bootstrap starts but /me API call never fires');
        console.log('Likely cause: Code hanging between session creation and API call');
        console.log('Location: App.tsx lines 570-581');
      } else if (hasSessionCreatedLog && hasMeRequest && !hasMeResponseLog) {
        console.log('Issue: /me request sent but response never received');
        console.log('Likely cause: API timeout or network hang');
        console.log('Check: Backend logs for /me endpoint');
      } else if (!hasSessionCreatedLog) {
        console.log('Issue: Bootstrap never starts');
        console.log('Likely cause: Session restoration failing or auth initialization blocked');
        console.log('Check: Supabase auth configuration');
      } else {
        console.log('Issue: Unknown - bootstrap appears to start but page stays blank');
        console.log('Check: React rendering pipeline or isLoadingSession flag');
      }
    } else {
      console.log('✅ Page rendered successfully');
    }

    if (errors.length > 0) {
      console.log(`\n⚠️  ${errors.length} JavaScript error(s) detected - may be causing issues`);
    }

    // Take a screenshot for visual confirmation
    await page.screenshot({ path: 'tests/e2e/ui/white-screen-diagnostic.png', fullPage: true });
    console.log('\n📸 Screenshot saved: tests/e2e/ui/white-screen-diagnostic.png');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DIAGNOSTIC COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Fail the test if white screen detected
    expect(isBlank).toBe(false);
  });
});

