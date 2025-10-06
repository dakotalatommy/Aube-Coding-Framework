# BrandVX UI Test Suite - Comprehensive Launch Validation

Complete Playwright test suite for validating the BrandVX platform before launch, with special focus on splash screen diagnostics and full UI navigation coverage.

## 📊 Test Coverage

### Total Tests: ~90 scenarios across 18 test suites

1. **Splash Screen Diagnostics** (10 tests) - Priority #1
2. **Authentication Flows** (8 tests)
3. **Full Navigation** (12 tests)
4. **Ask VX Chat** (7 tests)
5. **Dashboard** (2 tests)
6. **Clients Section** (4 tests)
7. **Messages Section** (2 tests)
8. **Agenda** (2 tests)
9. **Inventory** (2 tests)
10. **BrandVZN** (2 tests)
11. **Settings** (3 tests)
12. **Performance** (4 tests)
13. **Error Handling** (5 tests)
14. **Viewports/Responsive** (5 tests)
15. **Integrations** (Additional coverage)
16. **Accessibility** (Keyboard, ARIA)
17. **State Persistence** (Cross-navigation)
18. **Demo Mode** (If enabled)

## 🚀 Quick Start

### Prerequisites
```bash
# Ensure Playwright is installed (already in operator-ui)
cd /Users/dakotalatommy/Aube-Coding-Framework/apps/operator-ui
npm install
```

### Run All Tests
```bash
cd tests/e2e/ui
npx playwright test
```

### Run Specific Test Suite
```bash
# Splash diagnostics (PRIORITY #1)
npx playwright test splash/

# Navigation tests
npx playwright test navigation/

# Auth tests
npx playwright test auth/

# Specific test file
npx playwright test splash/splash-diagnostic.spec.ts
```

### Run by Browser/Viewport
```bash
# Laptop (1440x900 - your primary viewport)
npx playwright test --project=laptop-chrome

# iPhone
npx playwright test --project=iphone

# Tablet
npx playwright test --project=tablet
```

### Watch Mode (Interactive)
```bash
npx playwright test --ui
```

## 🎯 Key Test Suites

### 1. Splash Screen Diagnostics
**Location:** `splash/splash-diagnostic.spec.ts`

**Purpose:** Diagnose the multiple splash fires and white screen issues you described.

**Tests:**
- `splash-01` - Count splash fires on landing page
- `splash-02` - Track splash on sign-in click
- `splash-03` - **Monitor double-enable during auth callback** ⚠️
- `splash-04` - Verify workspace entry behavior
- `splash-05` - **Check splash fires on navigation** ⚠️ (currently 2x per nav)
- `splash-06` - Validate sessionStorage persistence
- `splash-07` - Confirm flag clears on logout
- `splash-08` - **Capture white screen timing** ⚠️
- `splash-09` - Full timeline of all splash events
- `splash-10` - Test element interaction blocking

**Key Findings:**
- ✅ Logs every splash state transition with timestamps
- ✅ Counts how many times splash fires
- ✅ Screenshots at each state
- ✅ Checks `bvx_splash_shown_<userId>` flags in sessionStorage
- ⚠️ **Will show you exactly where the double-enable happens**

**Expected Output:**
```
=== SPLASH LOG ANALYSIS ===
Total console logs: 127
Splash-related logs: 15
Splash fires: 4  <-- Should be 1!
===========================

Splash events:
  [2025-09-30T...] [splash] initializing {showSplash: false}
  [2025-09-30T...] [splash] enable (auth-callback)  <-- Issue #1
  [2025-09-30T...] [splash] enable (bootstrap)      <-- Issue #2
  ...
```

### 2. Full Navigation Tests
**Location:** `navigation/full-navigation.spec.ts`

**Tests all routes:**
- Dashboard ↔ Clients ↔ Messages ↔ Agenda ↔ Inventory ↔ BrandVZN ↔ Settings
- Direct URL access
- Browser back/forward
- Active nav highlighting
- Performance timing
- Rapid navigation stress test

### 3. Ask VX Chat Tests
**Location:** `sections/askvx.spec.ts`

**Validates:**
- Chat dock visible on all pages
- Expand/minimize functionality
- Send message & receive GPT response
- Chat history persistence
- Height constraint (no vertical scroll per your design)

### 4. Section-Specific Tests
**Location:** `sections/all-sections.spec.ts`

**Covers:**
- Dashboard: KPIs, workflows, quick actions
- Clients: List, search, detail view, pagination
- Messages: List, compose, threads
- Agenda: Calendar, appointments, sync
- Inventory: Products, sync, merge
- BrandVZN: Upload, edit, preview
- Settings: Tabs, save, persistence

### 5. Performance Tests
**Location:** `performance/performance.spec.ts`

**Measures:**
- Initial load time (< 10s)
- Navigation speed between sections (< 10s)
- API response times
- Memory leak detection

## 📁 Test Structure

```
tests/e2e/ui/
├── test-config.ts                    # Shared config & helpers
├── playwright.config.ts              # Playwright configuration
├── README.md                         # This file
│
├── splash/
│   └── splash-diagnostic.spec.ts    # 10 splash tests (PRIORITY)
│
├── auth/
│   └── authentication.spec.ts       # 8 auth flow tests
│
├── navigation/
│   └── full-navigation.spec.ts      # 12 navigation tests
│
├── sections/
│   ├── askvx.spec.ts                # 7 Ask VX tests
│   └── all-sections.spec.ts         # All workspace sections
│
├── performance/
│   └── performance.spec.ts          # 4 performance tests
│
├── integrations/
│   └── (Additional integration tests)
│
├── error-handling.spec.ts           # Error & viewport tests
│
├── screenshots/                     # Auto-generated screenshots
└── test-results/                    # Test reports & videos
```

## 🔧 Configuration

### Environment Variables
Create `.env` in this directory:

```bash
# Base URLs
BASE_URL=https://app.brandvx.io
API_BASE_URL=https://api.brandvx.io

# Test credentials (optional)
TEST_USER_EMAIL=test@brandvx.test
TEST_USER_PASSWORD=TestPassword123!
```

### Test Config
Edit `test-config.ts` to customize:
- Timeouts
- Selectors
- Routes
- Viewports

## 📊 Test Reports

### HTML Report
```bash
npx playwright show-report test-results/html
```

### JSON Results
```json
// test-results/results.json
{
  "suites": [...],
  "tests": [...],
  "stats": {
    "expected": 85,
    "unexpected": 5,
    "flaky": 0
  }
}
```

### Screenshots
- Saved to `screenshots/` directory
- Named with test + timestamp
- Full-page captures

### Videos
- Only on failure (configurable)
- Saved to `test-results/output/`

## 🐛 Debugging Tests

### Debug Mode
```bash
# Run with headed browser
npx playwright test --headed

# Debug specific test
npx playwright test --debug splash-03

# Slow motion
npx playwright test --headed --slow-mo=1000
```

### Inspect Element
```bash
# Use Playwright Inspector
npx playwright test --debug
```

### Console Logs
All console logs are captured in test output:
```typescript
page.on('console', msg => {
  console.log(`BROWSER LOG: ${msg.text()}`);
});
```

## 🎯 Focus Areas for Launch

### Critical Path (Must Pass)
1. ✅ Splash fires only once per session
2. ✅ No white screen on navigation
3. ✅ Auth flow works (Google + Email)
4. ✅ All navigation routes load
5. ✅ Ask VX chat responds
6. ✅ No vertical scroll (per design)

### High Priority
1. ⚠️ Fix double splash enable on auth callback
2. ⚠️ Fix splash firing 2x on navigation
3. ⚠️ Ensure elements are interactable (not blocked)
4. ⚠️ SessionStorage guard loads before auth listener

### Nice to Have
- Performance < 3s average navigation
- All KPIs display (fix 500 errors)
- Search/filter functionality
- Mobile responsive

## 📈 Running on CI/CD

### GitHub Actions Example
```yaml
name: UI Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - name: Install dependencies
        run: |
          cd apps/operator-ui
          npm install
          npx playwright install --with-deps
      - name: Run UI tests
        run: |
          cd tests/e2e/ui
          npx playwright test
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: tests/e2e/ui/test-results/
```

## 🔍 Splash Issue Analysis

### What the Tests Will Show

**Current Behavior (Before Fix):**
```
Landing → Splash fires 1x ✅
Click Sign In → Splash fires 1x ⚠️ (should be 0)
Auth Callback → Splash fires 2x ❌ (should be 1)
Navigate to Clients → Splash fires 2x ❌ (should be 0)
Refresh → Splash fires 1x ⚠️ (should be 0 due to guard)
```

**Expected Behavior (After Fix):**
```
Landing → Splash fires 1x ✅
Click Sign In → Splash fires 0x ✅
Auth Callback → Splash fires 1x ✅
Navigate to Clients → Splash fires 0x ✅
Refresh → Splash fires 0x ✅ (guard prevents)
```

### Root Cause (Per Your Analysis)
> The guard isn't hydrated before the auth-callback branch runs. When Supabase redirects back to /auth/callback, the listener fires immediately with newSession, and we call maybeEnableSplash('auth-callback'). At that moment we still have the default hasShownSplash.current === false.

**The tests will prove this** by showing the exact timing of:
1. When auth callback fires
2. When guard is checked
3. When splash enables

## 💡 Tips

### Run Only Critical Tests
```bash
# Just splash diagnostics
npx playwright test splash/ --project=laptop-chrome

# Just navigation
npx playwright test navigation/ --project=laptop-chrome
```

### Generate Test Code
```bash
# Record actions in browser
npx playwright codegen https://app.brandvx.io
```

### Update Snapshots
```bash
npx playwright test --update-snapshots
```

## 🚀 Next Steps

1. **Run splash diagnostics first:**
   ```bash
   npx playwright test splash/splash-diagnostic.spec.ts
   ```

2. **Review the console output** - it will show exact splash fire counts and timing

3. **Check screenshots in `screenshots/`** - visual confirmation of each state

4. **Review HTML report:**
   ```bash
   npx playwright show-report
   ```

5. **Use the timeline data** to fix the double-enable issues

6. **Re-run tests** after fixes to confirm

## 📞 Support

- **Playwright Docs:** https://playwright.dev
- **Test Config:** `test-config.ts`
- **Custom Selectors:** Add to `TEST_CONFIG.SELECTORS`

---

## ✅ Launch Readiness Checklist

Run this checklist before launch:

- [ ] All splash tests pass (10/10)
- [ ] Navigation tests pass (12/12)
- [ ] Auth flows work (8/8)
- [ ] Ask VX responds (7/7)
- [ ] No 500 errors on critical endpoints
- [ ] Performance < 5s average
- [ ] No horizontal scroll
- [ ] No vertical scroll
- [ ] Mobile viewport works
- [ ] All screenshots look correct

**Current Status:** 🟡 Tests built, ready to run

**Next Action:** Execute `npx playwright test` and review results
