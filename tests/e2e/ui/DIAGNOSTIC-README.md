# White Screen Diagnostic Test

## What This Test Does

This Playwright test comprehensively analyzes the white screen issue by capturing:

1. **Console Logs** - All `[bvx:auth]`, `[bvx:api]`, errors, and warnings
2. **Network Requests** - Every API call, timing, and status codes
3. **Page State** - Whether content renders, React mounts, localStorage values
4. **Screenshots** - Visual confirmation of the issue
5. **Diagnosis** - Automated analysis of where the code is hanging

## How to Run

### Option 1: Simple (Recommended)
```bash
cd tests/e2e/ui
./run-diagnostic.sh
```

### Option 2: Direct Playwright Command
```bash
cd tests/e2e/ui
npx playwright test white-screen-diagnostic.spec.ts --project=laptop-chrome --headed
```

### Option 3: Run from project root
```bash
cd /Users/dakotalatommy/Aube-Coding-Framework
npx playwright test tests/e2e/ui/white-screen-diagnostic.spec.ts --project=laptop-chrome --headed
```

## What to Expect

The test will:
1. ✅ Open Chromium browser (you'll see it)
2. ✅ Navigate to https://app.brandvx.io
3. ✅ Wait 10 seconds for bootstrap to complete
4. ✅ Analyze page state and capture data
5. ✅ Print detailed diagnostic report to console
6. ✅ Save screenshot as `white-screen-diagnostic.png`

## Output Example

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 STARTING PAGE LOAD DIAGNOSTIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[0ms] → GET https://app.brandvx.io
[234ms] [log] [bvx:auth] session created
[235ms] → GET https://api.brandvx.io/me
...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 KEY DIAGNOSTIC RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Console: [bvx:auth] session created
❌ Console: [bvx:auth] /me response
❌ Console: [bvx:auth] bootstrap completed
❌ Network: GET /me request
❌ UI: React content rendered
❌ UI: Page has content (not white screen)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 DIAGNOSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 WHITE SCREEN DETECTED

Issue: Bootstrap starts but /me API call never fires
Likely cause: Code hanging between session creation and API call
Location: App.tsx lines 570-581
```

## Auth State (Optional)

If you want to test with an authenticated session:
1. Sign in to https://app.brandvx.io manually
2. Save auth state: `npx playwright codegen https://app.brandvx.io --save-storage=tests/e2e/ui/auth-state.json`
3. Run the test again

The test will automatically use the saved auth state if available.

## Troubleshooting

**Test won't run:**
```bash
npx playwright install chromium
```

**Permission denied:**
```bash
chmod +x tests/e2e/ui/run-diagnostic.sh
```

**Need to see browser:**
Add `--headed` flag (already included in run-diagnostic.sh)

**Need to debug:**
Add `--debug` flag to pause and step through

## What We're Looking For

The test will tell us:
1. ✅ Does the session get created?
2. ✅ Does the `/me` API call fire?
3. ✅ Does the `/me` call return?
4. ✅ Does bootstrap complete?
5. ✅ Does React render content?
6. ✅ Is the page blank or showing content?

This will pinpoint exactly where in the flow the code is hanging.

