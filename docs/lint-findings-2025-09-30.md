# Lint Findings – 2025-09-30

## Summary
- `npm run lint` currently exits with **98 errors** and **49 warnings**.
- The failure is pre-existing on `main`; the new Supabase guard did not introduce additional lint debt.
- Most issues cluster into a handful of rule families. Tackling them in batches will unblock CI lint runs.

## Error Categories & Fix Strategies
### 1. React hook rule violations
- **Rules:** `react-hooks/rules-of-hooks`, `react-hooks/exhaustive-deps`
- **Files:** `CommandBar.tsx`, `WorkspaceShell.tsx`, `AppLegacy.tsx`, numerous scene/components.
- **Fix:**
  - Ensure hooks are only called inside React components/custom hooks.
  - Audit dependency arrays; include stable references or refactor to memoized callbacks.
  - In cases where dependencies intentionally omitted, document via `// eslint-disable-next-line` with justification (prefer code changes over disables).

### 2. Unused or mis-declared variables
- **Rule:** `@typescript-eslint/no-unused-vars`
- **Files:** `api.ts`, `Approvals.tsx`, `Billing.tsx`, `Dashboard.tsx`, `Integrations.tsx`, multiple v2 components.
- **Fix:** Remove dead variables, destructure only needed fields, or prefix with `_` when intentionally unused.

### 3. Banned TypeScript directives
- **Rule:** `@typescript-eslint/ban-ts-comment`
- **Files:** Many v2 components (`analytics-chart.tsx`, `appointments-preview.tsx`, etc.) use `@ts-nocheck` or `@ts-ignore`.
- **Fix:**
  - Replace broad `@ts-nocheck` with targeted typing fixes.
  - Where suppression is unavoidable, switch to `// @ts-expect-error` with an explanatory comment.

### 4. Constant truthiness & boolean logic
- **Rule:** `no-constant-binary-expression`, `no-extra-boolean-cast`
- **Files:** `Dashboard.tsx`, `Vision.tsx`, `Integrations.tsx`, `v2/App.tsx`.
- **Fix:** Remove redundant `&& true` patterns, replace with direct conditionals, ensure optional chaining/length checks return actual booleans.

### 5. Parsing & syntax errors in legacy test harness
- **Files:** `apps/operator-ui/test-cors/src/*.js`
- **Issue:** ESLint can’t parse embedded HTML (likely CRA test scaffolding).
- **Fix:** Either exclude the `test-cors` package from root lint via `.eslintignore`, or adjust parser config for that directory if it must stay linted.

## Warning Categories & Fix Strategies
### A. React hook dependency warnings
- **Rule:** `react-hooks/exhaustive-deps`
- **Fix:** Same approach as in Error Category 1; many warnings become errors once configured in CI.

### B. Unnecessary escape characters
- **Rule:** `no-useless-escape`
- **Files:** `SupportBubble.tsx`, `LandingV2.tsx`, `landing-page.tsx`, `guide.ts`.
- **Fix:** Remove superfluous backslashes or, if needed for regex, wrap strings with template literals and annotate intent.

### C. Unused eslint-disable directives
- **Rule:** `eslint-comments/no-unused-disable`
- **Files:** `SupportBubble.tsx`, `Vision.tsx`.
- **Fix:** Delete stale disable comments or ensure corresponding code still requires suppression.

## Recommended Remediation Plan
1. **Stabilize hooks:** Address `react-hooks/rules-of-hooks` errors first—they can hide runtime bugs.
2. **Sweep for unused vars & constants:** Quick wins that reduce noise.
3. **Remove `@ts-nocheck`:** Create tickets per component group (AskVX, Landing, Vision) to add typings.
4. **Decide on `test-cors/`:** Either move to its own ESLint project or ignore in root config.
5. **Guard regressions:** Add a lint GitHub Action to prevent new violations once backlog is cleared.

## Command Reference
```bash
npm run lint            # current failure snapshot
npx eslint <file> --fix # spot-fix individual files (use judiciously)
```
