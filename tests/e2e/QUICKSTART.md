# UI V2 Test Suite - Quick Start Guide

## TL;DR

```bash
cd tests/e2e
npm install
npm test
```

## First Time Setup (2 minutes)

### 1. Install Dependencies
```bash
cd tests/e2e
npm install
```

### 2. Verify Environment
The `.env` file should already be configured with:
```bash
VITE_SUPABASE_URL=https://dwfvnqajrwruprqbjxph.supabase.co
VITE_SUPABASE_ANON_KEY=[configured]
SUPABASE_SERVICE_ROLE_KEY=[configured]
API_BASE_URL=https://api.brandvx.io
```

### 3. Run Tests
```bash
npm test
```

## Expected Output

```
══════════════════════════════════════════════════════════════════════
UI V2 Launch Test Suite
══════════════════════════════════════════════════════════════════════

🔐 Test 1: Auth Bootstrap
  ✅ Token obtained for user [user-id]
  ✅ Token verified with Supabase
  ✅ /me endpoint returned tenant_id: [tenant-id]

📊 Test 2: Dashboard Data Fetches
  ✅ KPIs: HTTP 200
  ✅ Metrics: HTTP 200
  ...

[9 more tests]

══════════════════════════════════════════════════════════════════════
Test Results Summary
══════════════════════════════════════════════════════════════════════
✅ PASS - Auth Bootstrap (1888ms)
✅ PASS - Dashboard Data Fetches (682ms)
...
══════════════════════════════════════════════════════════════════════
Total: 10 | Passed: 9 | Failed: 1
══════════════════════════════════════════════════════════════════════

📝 Detailed results written to: test-results-[timestamp].json
```

## What Gets Tested

1. ✅ **Auth** - Token minting, Supabase auth, tenant detection
2. ✅ **Dashboard** - KPIs, metrics, contacts, referrals, follow-ups
3. ✅ **Imports** - Square & Acuity contact imports + backfills
4. ✅ **Messaging** - Contacts list, message history, draft batches
5. ✅ **AskVX** - AI chat functionality
6. ✅ **BrandVZN** - Image editing tools
7. ✅ **Inventory** - Sync, merge, metrics
8. ✅ **Settings** - Read, write, persistence
9. ✅ **Export** - CSV contact export
10. ✅ **OAuth** - Integration status, provider URLs

## Running Against Different Environments

### Local API
```bash
npm run test:local
```

### Staging API
```bash
npm run test:staging
```

### Production API (default)
```bash
npm test
```

## Using the Bash Runner

```bash
./run.sh
```

The bash script:
- ✅ Validates environment variables
- ✅ Auto-installs dependencies if needed
- ✅ Shows configuration before running
- ✅ Provides colored output

## Troubleshooting

### "Missing required environment variables"
**Fix:** Check `.env` file exists and contains all required values

### "Failed to sign in test user"
**Fix:** Test user will be auto-created on first run (this is normal)

### "No tenant_id found in /me response"
**Fix:** User needs tenant association (auto-created for new users)

### Individual endpoint failures
**Non-blocking:** Tests continue even if some endpoints fail. Check JSON output for details.

## Output Files

- **Console:** Real-time test execution
- **JSON:** `test-results-[timestamp].json` - Detailed results for CI/CD

## CI/CD Integration

Add to your pipeline:
```yaml
- name: Run API Tests
  run: |
    cd tests/e2e
    npm install
    npm test
  env:
    VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

## Next Steps

- ✅ Tests are working
- 📊 Review detailed results in JSON file
- 🔧 Fix any failing endpoints
- 🔄 Add to CI/CD for automated testing

## Need More Details?

See `README.md` for comprehensive documentation.
