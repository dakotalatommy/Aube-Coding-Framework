# UI V2 Launch Test Suite

End-to-end API integration tests for the BrandVX UI V2 launch, implementing all test scenarios from `docs/ui-v2-test-suite-plan.md`.

## Overview

This test suite validates:
1. ✅ **Auth Bootstrap** - Token minting and user authentication
2. ✅ **Dashboard Data Fetches** - KPIs, metrics, contacts, etc.
3. ✅ **Client Import + Backfill** - Square and Acuity integrations
4. ✅ **Messaging & Follow-Up Drafting** - Message flows and batch drafts
5. ✅ **AskVX Chat** - AI-powered chat functionality
6. ✅ **BrandVZN Image Edit** - AI image editing tools
7. ✅ **Inventory Sync & Merge** - Product catalog management
8. ✅ **Settings Save** - User settings persistence
9. ✅ **Contacts Export** - CSV export functionality
10. ✅ **Integrations/OAuth Status** - Provider connections

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the environment template and configure with your credentials:

```bash
cp .env.template .env
```

Edit `.env` with your Supabase credentials and API base URL.

**Required Variables:**
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for minting tokens)
- `API_BASE_URL` - BrandVX API base URL (default: https://api.brandvx.io)

**Optional Variables:**
- `TEST_TENANT_ID` - Specific tenant to test (auto-detected if omitted)
- `TEST_USER_EMAIL` - Existing test user email (creates new user if omitted)
- `TEST_USER_PASSWORD` - Test user password (required if email provided)

### 3. Run Tests

```bash
# Run against production API
npm test

# Run against local API
npm run test:local

# Run against staging API
npm run test:staging
```

## Test Architecture

### Token Management
- Uses Supabase service role key to mint JWT tokens on demand
- Automatically creates test users if credentials not provided
- Caches access token and tenant context across test runs
- Ensures proper tenant isolation for all API calls

### Request Handling
- All API requests automatically include tenant context
- Bearer token authentication for protected endpoints
- Proper query string and JSON body formatting
- Response validation and error handling

### Logging
- Per-test detailed logging with timestamps
- Success/failure tracking for each test case
- Duration metrics for performance monitoring
- JSON output with full test results

## Test Results

Tests output:
1. **Console logs** - Real-time test execution feedback
2. **JSON file** - Detailed results saved to `test-results-[timestamp].json`

Example output:
```
══════════════════════════════════════════════════════════════════════
UI V2 Launch Test Suite
══════════════════════════════════════════════════════════════════════
API Base URL: https://api.brandvx.io
Supabase URL: https://dwfvnqajrwruprqbjxph.supabase.co
Test Tenant: auto-detect
══════════════════════════════════════════════════════════════════════

🔐 Test 1: Auth Bootstrap
  ✅ Token obtained for user abc123
  ✅ Token verified with Supabase
  ✅ /me endpoint returned tenant_id: tenant-xyz

📊 Test 2: Dashboard Data Fetches
  ✅ KPIs: HTTP 200
  ✅ Metrics: HTTP 200
  ...

══════════════════════════════════════════════════════════════════════
Test Results Summary
══════════════════════════════════════════════════════════════════════
✅ PASS - Auth Bootstrap (523ms)
✅ PASS - Dashboard Data Fetches (1247ms)
...
══════════════════════════════════════════════════════════════════════
Total: 10 | Passed: 10 | Failed: 0
══════════════════════════════════════════════════════════════════════
```

## Test Isolation

- Tests use dedicated test tenant to avoid polluting production data
- Each test run can create a new user or reuse existing test credentials
- Idempotency keys ensure safe re-runs without duplicate operations
- No cleanup required - tests are read-heavy with minimal mutations

## Troubleshooting

### Missing Environment Variables
```
Error: Missing required environment variables: SUPABASE_SERVICE_ROLE_KEY
```
**Solution:** Copy `.env.template` to `.env` and fill in all required values.

### Authentication Failures
```
Failed to sign in test user: Invalid credentials
```
**Solution:** Verify `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` are correct, or remove them to auto-create a new user.

### Tenant Context Issues
```
No tenant_id found in /me response
```
**Solution:** Ensure the test user has a valid tenant association in the database, or specify `TEST_TENANT_ID` manually.

### API Endpoint Failures
Individual endpoint failures are logged but don't stop the test suite. Review the JSON output file for detailed error information.

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Run E2E API Tests
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    API_BASE_URL: https://api.brandvx.io
  run: |
    cd tests/e2e
    npm install
    npm test
```

### Jenkins/CircleCI
Store credentials in your CI platform's secret management and inject as environment variables.

## Extending Tests

To add new test cases:

1. Create a new test function following the pattern:
```typescript
async function testMyNewFeature(): Promise<TestResult> {
  const logger = new TestLogger('My New Feature');
  console.log('\n🎯 Test X: My New Feature');
  
  try {
    // Test logic here
    logger.log('Testing...');
    const response = await apiRequest('GET', '/my/endpoint');
    logger.success('Test passed');
    
    return {
      name: 'My New Feature',
      passed: true,
      duration: logger.getElapsedTime(),
      logs: logger.getAllLogs(),
    };
  } catch (error: any) {
    logger.error('Test failed', error);
    return {
      name: 'My New Feature',
      passed: false,
      duration: logger.getElapsedTime(),
      error: error.message,
      logs: logger.getAllLogs(),
    };
  }
}
```

2. Add the test to the `tests` array in `runAllTests()`.

## File Structure

```
tests/e2e/
├── test-helpers.ts       # Utility functions for auth, API calls, logging
├── run-tests.ts          # Main test runner with all test cases
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── .env.template         # Environment variable template
├── .env                  # Your local environment (gitignored)
└── README.md            # This file
```

## Support

For issues or questions:
1. Check the detailed JSON output file for error details
2. Review the logs for specific endpoint failures
3. Verify environment configuration matches the template
4. Ensure API base URL is accessible from your network
