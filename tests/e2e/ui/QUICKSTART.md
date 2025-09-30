# UI Test Suite - Quick Start

## TL;DR

```bash
cd tests/e2e/ui
npx playwright test --ui
```

## 🎯 Most Important Test (Splash Diagnostics)

```bash
npx playwright test splash/splash-diagnostic.spec.ts
```

This will show you:
- Exact count of splash fires at each step
- Console timeline with timestamps
- Screenshots of each state
- SessionStorage flag status
- Where the double-enable happens

## 📊 Expected Output

```
=== SPLASH LOG ANALYSIS ===
Splash fires: 4  <-- Should be 1!

Splash events:
  [12:34:56.789] [splash] enable (auth-callback)  <-- Issue
  [12:34:57.123] [splash] enable (bootstrap)      <-- Issue
===========================
```

## Common Commands

### Run All Tests
```bash
npx playwright test
```

### Specific Suites
```bash
npx playwright test splash/      # Splash diagnostics
npx playwright test navigation/  # Navigation tests
npx playwright test auth/        # Auth flows
npx playwright test sections/    # All sections
```

### Debug Mode
```bash
npx playwright test --ui         # Interactive UI
npx playwright test --headed     # See browser
npx playwright test --debug      # Step-by-step
```

### View Results
```bash
npx playwright show-report
```

## 🐛 Debugging Splash Issues

### What to Look For

1. **Console logs** - Count of "enable" calls
2. **Screenshots** - Visual state at each step
3. **SessionStorage** - `bvx_splash_shown_<userId>` flags
4. **Timing** - When auth callback fires vs when guard loads

### Key Tests

- **splash-03** - Auth callback double-enable ⚠️
- **splash-05** - Navigation 2x fire ⚠️
- **splash-08** - White screen capture ⚠️
- **splash-10** - Interaction blocking ⚠️

## 📁 Where to Find Results

- **Screenshots:** `screenshots/`
- **HTML Report:** `test-results/html/index.html`
- **Videos:** `test-results/output/`
- **JSON:** `test-results/results.json`

## 🚀 Quick Win

Run splash tests, review output, fix identified issues, re-run to confirm.

**Total time:** ~5 minutes to get diagnostic data

## Need Help?

See `README.md` for comprehensive documentation.
