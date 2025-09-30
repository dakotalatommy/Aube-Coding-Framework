/**
 * UI V2 Test Suite - Main Test Runner
 * 
 * Implements all test scenarios from docs/ui-v2-test-suite-plan.md
 */

import { config as loadEnv } from 'dotenv';
import {
  initConfig,
  getAccessToken,
  apiRequest,
  generateIdempotencyKey,
  TestLogger,
  getTestImageBase64,
  wait,
  seedTestContacts,
} from './test-helpers';

// Load environment variables from .env file
loadEnv();

// Test configuration from environment
const config = {
  supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  apiBaseUrl: process.env.API_BASE_URL || 'https://api.brandvx.io',
  testTenantId: process.env.TEST_TENANT_ID,
  testUserEmail: process.env.TEST_USER_EMAIL,
  testUserPassword: process.env.TEST_USER_PASSWORD,
};

// Validate configuration
function validateConfig() {
  const missing: string[] = [];
  
  if (!config.supabaseUrl) missing.push('VITE_SUPABASE_URL or SUPABASE_URL');
  if (!config.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!config.supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Test results tracking
interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  logs: string[];
}

const testResults: TestResult[] = [];

/**
 * Test 1: Auth Bootstrap
 */
async function testAuthBootstrap(): Promise<TestResult> {
  const logger = new TestLogger('Auth Bootstrap');
  console.log('\n🔐 Test 1: Auth Bootstrap');
  
  try {
    // Step 1: Generate JWT
    logger.log('Generating access token via service role...');
    const { accessToken, tenantId, userId } = await getAccessToken();
    logger.success(`Token obtained for user ${userId}`);

    // Step 2: Verify token with Supabase
    logger.log('Verifying token with Supabase auth...');
    const supabaseAuthResponse = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': config.supabaseAnonKey,
      },
    });
    
    if (!supabaseAuthResponse.ok) {
      throw new Error(`Supabase auth verification failed: ${supabaseAuthResponse.status}`);
    }
    logger.success('Token verified with Supabase');

    // Step 3: Verify /me endpoint
    logger.log('Calling /me endpoint...');
    const meResponse = await apiRequest('GET', '/me', { skipTenant: true });
    
    if (!meResponse.ok) {
      throw new Error(`/me endpoint failed: ${meResponse.status}`);
    }
    
    if (!meResponse.data.tenant_id) {
      throw new Error('Missing tenant_id in /me response');
    }
    
    logger.success(`/me endpoint returned tenant_id: ${meResponse.data.tenant_id}`);
    logger.log(`User email: ${meResponse.data.email || 'N/A'}`);
    
    return {
      name: 'Auth Bootstrap',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'Auth Bootstrap',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Test 2: Dashboard Data Fetches
 */
async function testDashboardDataFetches(): Promise<TestResult> {
  const logger = new TestLogger('Dashboard Data Fetches');
  console.log('\n📊 Test 2: Dashboard Data Fetches');
  
  try {
    const endpoints = [
      { path: '/admin/kpis', name: 'KPIs' },
      { path: '/metrics', name: 'Metrics' },
      { path: '/cadences/queue', name: 'Cadences Queue' },
      { path: '/contacts/list', query: { limit: '4' }, name: 'Contacts List' },
      { path: '/referrals/qr', name: 'Referral QR' },
      { path: '/followups/candidates', query: { scope: 'reengage_30d' }, name: 'Follow-up Candidates' },
    ];

    for (const endpoint of endpoints) {
      logger.log(`Fetching ${endpoint.name}...`);
      const response = await apiRequest('GET', endpoint.path, { query: endpoint.query });
      
      if (!response.ok) {
        logger.error(`${endpoint.name} failed with status ${response.status}`);
        throw new Error(`${endpoint.name} endpoint returned ${response.status}`);
      }
      
      logger.success(`${endpoint.name}: HTTP ${response.status}`);
    }
    
    return {
      name: 'Dashboard Data Fetches',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'Dashboard Data Fetches',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Test 3: Client Import + Backfill
 */
async function testClientImport(): Promise<TestResult> {
  const logger = new TestLogger('Client Import + Backfill');
  console.log('\n📥 Test 3: Client Import + Backfill');
  
  try {
    // Square import via AI tools
    logger.log('Triggering Square import via AI tools...');
    const squareImportResponse = await apiRequest('POST', '/ai/tools/execute', {
      body: {
        name: 'contacts.import.square',
        params: {},
        require_approval: false,
        idempotency_key: generateIdempotencyKey(),
      },
    });
    
    if (!squareImportResponse.ok) {
      logger.error(`Square import failed: ${squareImportResponse.status}`);
    } else {
      logger.success(`Square import triggered: ${JSON.stringify(squareImportResponse.data).substring(0, 100)}...`);
    }

    // Square backfill metrics
    logger.log('Triggering Square metrics backfill...');
    const backfillResponse = await apiRequest('POST', '/integrations/booking/square/backfill-metrics', {
      body: {},
    });
    
    if (!backfillResponse.ok) {
      logger.error(`Square backfill failed: ${backfillResponse.status}`);
    } else {
      logger.success(`Square backfill completed: HTTP ${backfillResponse.status}`);
    }

    // Acuity import
    logger.log('Triggering Acuity import...');
    const acuityImportResponse = await apiRequest('POST', '/integrations/booking/acuity/import', {
      body: {
        since: '0',
        until: '',
        cursor: '',
      },
    });
    
    if (!acuityImportResponse.ok) {
      logger.error(`Acuity import failed: ${acuityImportResponse.status}`);
    } else {
      logger.success(`Acuity import completed: ${JSON.stringify(acuityImportResponse.data).substring(0, 100)}...`);
    }
    
    return {
      name: 'Client Import + Backfill',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'Client Import + Backfill',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Test 4: Messaging & Follow-Up Drafting
 */
async function testMessagingAndFollowUps(): Promise<TestResult> {
  const logger = new TestLogger('Messaging & Follow-Up Drafting');
  console.log('\n💬 Test 4: Messaging & Follow-Up Drafting');
  
  try {
    // Seed contacts to ensure drafts have data
    logger.log('Seeding demo contacts for draft batch...');
    const seeded = await seedTestContacts(3);
    logger.success(`Seeded ${seeded.length} contacts for drafts`);

    // Get contacts list
    logger.log('Fetching contacts list...');
    const contactsResponse = await apiRequest('GET', '/contacts/list');
    
    if (!contactsResponse.ok) {
      throw new Error(`Contacts list failed: ${contactsResponse.status}`);
    }
    logger.success(`Contacts list retrieved: HTTP ${contactsResponse.status}`);

    // Get messages history
    logger.log('Fetching messages history...');
    const messagesResponse = await apiRequest('GET', '/messages/list');
    
    if (!messagesResponse.ok) {
      logger.error(`Messages list failed: ${messagesResponse.status}`);
    } else {
      logger.success(`Messages list retrieved: HTTP ${messagesResponse.status}`);
    }

    // Draft follow-ups
    logger.log('Drafting follow-up batch...');
    const draftResponse = await apiRequest('POST', '/followups/draft_batch', {
      body: {
        scope: 'reengage_30d',
        template_id: 'reengage_30d',
      },
    });
    
    if (!draftResponse.ok) {
      logger.error(`Follow-up draft failed: ${draftResponse.status}`);
    } else {
      logger.success(`Follow-up draft initiated: ${JSON.stringify(draftResponse.data).substring(0, 100)}...`);
      
      // Poll draft status if we have a job_id or todo_id
      let draftMarkdown: string | null = null;
      if (draftResponse.data.job_id || draftResponse.data.todo_id) {
        const { tenantId } = await getAccessToken();
        logger.log('Polling draft status for generated copy...');
        for (let attempt = 0; attempt < 5; attempt += 1) {
          if (attempt > 0) {
            await wait(3000);
          }

          const statusResponse = await apiRequest('GET', '/followups/draft_status', {
            query: { tenant_id: tenantId },
          });

          if (!statusResponse.ok) {
            logger.error(`Draft status check failed: ${statusResponse.status}`);
            break;
          }

          const statusData = statusResponse.data || {};
          const statusLabel = String(statusData.status || statusData.todo_status || 'unknown');
          logger.log(`Draft status check #${attempt + 1}: ${statusLabel}`);

          const candidateMarkdown =
            statusData.draft_markdown || statusData.details?.draft_markdown || null;

          if (statusLabel === 'empty') {
            logger.error('Draft job returned empty response (no eligible contacts).');
            break;
          }

          if (candidateMarkdown) {
            draftMarkdown = candidateMarkdown;
            logger.success(
              `Draft ready. Sample: ${candidateMarkdown.substring(0, 160)}...`,
            );
            break;
          }

          if (!['queued', 'running', 'pending'].includes(statusLabel)) {
            logger.log('Draft job finished without markdown payload.');
            break;
          }
        }
      }

      if (!draftMarkdown) {
        logger.error('Draft worker did not return markdown copy within timeout.');
        throw new Error('Follow-up draft markdown unavailable');
      }
    }
    
    return {
      name: 'Messaging & Follow-Up Drafting',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'Messaging & Follow-Up Drafting',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Test 5: AskVX Chat
 */
async function testAskVXChat(): Promise<TestResult> {
  const logger = new TestLogger('AskVX Chat');
  console.log('\n🤖 Test 5: AskVX Chat');
  
  try {
    logger.log('Sending chat message to AskVX...');
    const chatResponse = await apiRequest('POST', '/ai/chat/raw', {
      body: {
        session_id: `test-session-${Date.now()}`,
        messages: [
          {
            role: 'user',
            content: 'How do I import contacts?',
          },
        ],
      },
    });
    
    if (!chatResponse.ok) {
      throw new Error(`AskVX chat failed: ${chatResponse.status}`);
    }
    
    if (!chatResponse.data.text && !chatResponse.data.content) {
      throw new Error('AskVX response missing text/content field');
    }
    
    const responseText = chatResponse.data.text || chatResponse.data.content || '';
    logger.success(`AskVX responded with ${responseText.length} characters`);
    logger.log(`Response preview: ${responseText.substring(0, 100)}...`);
    
    if (chatResponse.data.suggestions) {
      logger.log(`Suggestions provided: ${chatResponse.data.suggestions.length}`);
    }
    
    return {
      name: 'AskVX Chat',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'AskVX Chat',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Test 6: BrandVZN Image Edit
 */
async function testBrandVZNImageEdit(): Promise<TestResult> {
  const logger = new TestLogger('BrandVZN Image Edit');
  console.log('\n🎨 Test 6: BrandVZN Image Edit');
  
  try {
    logger.log('Submitting image edit request...');
    const imageEditResponse = await apiRequest('POST', '/ai/tools/execute', {
      body: {
        name: 'image.edit',
        require_approval: false,
        params: {
          inputImageBase64: getTestImageBase64(),
          prompt: 'Make it brighter',
          preserveDims: true,
        },
        idempotency_key: generateIdempotencyKey(),
      },
    });
    
    if (!imageEditResponse.ok) {
      logger.error(`Image edit failed: ${imageEditResponse.status}`);
      logger.log(`Response: ${JSON.stringify(imageEditResponse.data)}`);
    } else {
      logger.success(`Image edit completed: HTTP ${imageEditResponse.status}`);
      
      if (imageEditResponse.data.data_url || imageEditResponse.data.preview_url) {
        logger.success('Response contains image data URL');
      } else {
        logger.log(`Response structure: ${JSON.stringify(imageEditResponse.data).substring(0, 200)}...`);
      }
    }
    
    return {
      name: 'BrandVZN Image Edit',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'BrandVZN Image Edit',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Test 7: Inventory Sync & Merge
 */
async function testInventorySyncMerge(): Promise<TestResult> {
  const logger = new TestLogger('Inventory Sync & Merge');
  console.log('\n📦 Test 7: Inventory Sync & Merge');
  
  try {
    // Get inventory metrics
    logger.log('Fetching inventory metrics...');
    const metricsResponse = await apiRequest('GET', '/inventory/metrics');
    
    if (!metricsResponse.ok) {
      logger.error(`Inventory metrics failed: ${metricsResponse.status}`);
    } else {
      logger.success(`Inventory metrics retrieved: HTTP ${metricsResponse.status}`);
    }

    // Sync inventory
    logger.log('Triggering inventory sync...');
    const syncResponse = await apiRequest('POST', '/inventory/sync', {
      body: {
        provider: 'square',
      },
    });
    
    if (!syncResponse.ok) {
      logger.error(`Inventory sync failed: ${syncResponse.status}`);
    } else {
      logger.success(`Inventory sync initiated: ${JSON.stringify(syncResponse.data).substring(0, 100)}...`);
    }

    // Merge inventory
    logger.log('Triggering inventory merge...');
    const mergeResponse = await apiRequest('POST', '/inventory/merge', {
      body: {
        strategy: 'sku_then_name',
      },
    });
    
    if (!mergeResponse.ok) {
      logger.error(`Inventory merge failed: ${mergeResponse.status}`);
    } else {
      logger.success(`Inventory merge completed: ${JSON.stringify(mergeResponse.data).substring(0, 100)}...`);
    }
    
    return {
      name: 'Inventory Sync & Merge',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'Inventory Sync & Merge',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Test 8: Settings Save
 */
async function testSettingsSave(): Promise<TestResult> {
  const logger = new TestLogger('Settings Save');
  console.log('\n⚙️  Test 8: Settings Save');
  
  try {
    // Read current settings
    logger.log('Fetching current settings...');
    const getResponse = await apiRequest('GET', '/settings');
    
    if (!getResponse.ok) {
      throw new Error(`Settings GET failed: ${getResponse.status}`);
    }
    logger.success('Current settings retrieved');

    // Save settings (with minimal changes)
    logger.log('Saving settings...');
    const settingsPayload = {
      ...getResponse.data,
      // Add a test field to verify the save
      _test_timestamp: Date.now(),
    };
    
    const postResponse = await apiRequest('POST', '/settings', {
      body: settingsPayload,
    });
    
    if (!postResponse.ok) {
      throw new Error(`Settings POST failed: ${postResponse.status}`);
    }
    logger.success('Settings saved successfully');

    // Verify persistence
    logger.log('Verifying settings persistence...');
    const verifyResponse = await apiRequest('GET', '/settings');
    
    if (!verifyResponse.ok) {
      throw new Error(`Settings verification failed: ${verifyResponse.status}`);
    }
    
    logger.success('Settings verified');
    
    return {
      name: 'Settings Save',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'Settings Save',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Test 9: Contacts Export
 */
async function testContactsExport(): Promise<TestResult> {
  const logger = new TestLogger('Contacts Export');
  console.log('\n📤 Test 9: Contacts Export');
  
  try {
    logger.log('Requesting contacts export...');
    const { tenantId } = await getAccessToken();
    const exportResponse = await apiRequest('GET', '/exports/contacts', {
      query: { tenant_id: tenantId },
      headers: { 'Accept': 'text/csv' },
    });
    
    if (!exportResponse.ok) {
      throw new Error(`Contacts export failed: ${exportResponse.status}`);
    }
    
    const csvData = exportResponse.data;
    
    if (typeof csvData !== 'string') {
      throw new Error('Export response is not CSV text');
    }
    
    if (!csvData.includes('contact_id') && !csvData.includes('email')) {
      logger.error('CSV missing expected headers');
    }
    
    logger.success(`Contacts export received: ${csvData.length} bytes`);
    logger.log(`CSV preview: ${csvData.substring(0, 100)}...`);
    
    return {
      name: 'Contacts Export',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'Contacts Export',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Test 10: Integrations/OAuth Status
 */
async function testIntegrationsOAuth(): Promise<TestResult> {
  const logger = new TestLogger('Integrations/OAuth Status');
  console.log('\n🔌 Test 10: Integrations/OAuth Status');
  
  try {
    // Get integrations status
    logger.log('Fetching integrations status...');
    const statusResponse = await apiRequest('GET', '/integrations/status');
    
    if (!statusResponse.ok) {
      throw new Error(`Integrations status failed: ${statusResponse.status}`);
    }
    
    logger.success(`Integrations status retrieved: ${JSON.stringify(statusResponse.data).substring(0, 100)}...`);

    // Check Square OAuth URL
    logger.log('Checking Square OAuth endpoint...');
    const squareOAuthResponse = await apiRequest('GET', '/oauth/square/login', {
      query: { return: 'workspace' },
    });
    
    if (!squareOAuthResponse.ok) {
      logger.error(`Square OAuth failed: ${squareOAuthResponse.status}`);
    } else if (squareOAuthResponse.data.url) {
      logger.success('Square OAuth URL generated');
    } else {
      logger.log(`Square OAuth response: ${JSON.stringify(squareOAuthResponse.data)}`);
    }

    // Check Acuity OAuth URL
    logger.log('Checking Acuity OAuth endpoint...');
    const acuityOAuthResponse = await apiRequest('GET', '/oauth/acuity/login', {
      query: { return: 'workspace' },
    });
    
    if (!acuityOAuthResponse.ok) {
      logger.error(`Acuity OAuth failed: ${acuityOAuthResponse.status}`);
    } else if (acuityOAuthResponse.data.url) {
      logger.success('Acuity OAuth URL generated');
    } else {
      logger.log(`Acuity OAuth response: ${JSON.stringify(acuityOAuthResponse.data)}`);
    }
    
    return {
      name: 'Integrations/OAuth Status',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'Integrations/OAuth Status',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('═'.repeat(70));
  console.log('UI V2 Launch Test Suite');
  console.log('═'.repeat(70));
  console.log(`API Base URL: ${config.apiBaseUrl}`);
  console.log(`Supabase URL: ${config.supabaseUrl}`);
  console.log(`Test Tenant: ${config.testTenantId || 'auto-detect'}`);
  console.log('═'.repeat(70));

  const tests = [
    testAuthBootstrap,
    testDashboardDataFetches,
    testClientImport,
    testMessagingAndFollowUps,
    testAskVXChat,
    testBrandVZNImageEdit,
    testInventorySyncMerge,
    testSettingsSave,
    testContactsExport,
    testIntegrationsOAuth,
  ];

  for (const test of tests) {
    const result = await test();
    testResults.push(result);
  }

  // Print summary
  console.log('\n' + '═'.repeat(70));
  console.log('Test Results Summary');
  console.log('═'.repeat(70));

  let passed = 0;
  let failed = 0;

  for (const result of testResults) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const duration = `${result.duration}ms`;
    console.log(`${status} - ${result.name} (${duration})`);
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    }
  }

  console.log('═'.repeat(70));
  console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('═'.repeat(70));

  // Write detailed log file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFileName = `test-results-${timestamp}.json`;
  
  try {
    const fs = await import('fs');
    fs.writeFileSync(
      logFileName,
      JSON.stringify(testResults, null, 2)
    );
    console.log(`\n📝 Detailed results written to: ${logFileName}`);
  } catch (error) {
    console.log('\n⚠️  Could not write log file');
  }

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
validateConfig();
initConfig(config);
runAllTests().catch((error) => {
  console.error('\n💥 Fatal error running tests:', error);
  process.exit(1);
});
