# UI V2 Tenant & Import Cleanup Plan

## Goal
Eliminate duplicate tenant parameter plumbing, restore Square/Acuity import parity, and fix CSV export/OAuth edge cases ahead of launch.

## Scope
- `apps/operator-ui/src/v2`
- Shared helpers under `apps/operator-ui/src/lib`
- No backend edits required (assumes existing endpoints continue to behave per legacy UI)

## Preconditions
- UI builds locally with current env values (`VITE_*`, Supabase keys, backend base URL).
- Legacy dashboards/imports still function (reference `apps/operator-ui/src/pages/Contacts.tsx` for parity).
- Branch in clean state; capture `git status` before/after.

---

## Step-by-step Execution

### 1. Tenant Plumbing Audit & Cleanup
1. Enumerate all V2 files that add `tenant_id` manually (search for `tenant_id` in `apps/operator-ui/src/v2`). Typical offenders:
   - `components/clients.tsx` (query params + POST payloads)
   - `components/messages.tsx` (history query params)
   - `components/agenda.tsx`, `inventory.tsx`, `askvx.tsx`, `brandvzn.tsx`, `settings.tsx`, etc.
2. For GET/DELETE calls:
   - Remove `tenant_id` from `URLSearchParams` / string literals.
   - Delegate to `api.get('/endpoint', opts)`; rely on helper injection.
3. For POST/PUT/PATCH bodies:
   - Drop explicit `tenant_id` fields unless the backend requires them as domain data (verify each payload against backend docs).
   - If an endpoint truly needs `tenant_id` in the JSON payload (rare), expose an opt-out flag in the helper rather than duplicating.
4. Update JSDoc/comments where needed to explain that the helper injects tenant automatically.
5. Run `npm run lint` (or equivalent) to catch unused imports/vars that result from the cleanup.

### 2. Client Import Flow Restoration
1. Study the legacy import flow (`apps/operator-ui/src/pages/Contacts.tsx:120-168`).
2. Recreate equivalent logic inside V2 `Clients` component:
   - Call `/onboarding/analyze` to determine which provider(s) are connected.
   - When Square is connected, call `/ai/tools/execute` with `contacts.import.square` plus idempotency key.
   - When Acuity is connected, call `/integrations/booking/acuity/import`.
   - Fallback: `/calendar/sync` with `{ provider: 'auto' }`.
   - After Square imports, call `/integrations/booking/square/backfill-metrics`.
3. Preserve toasts, summary banners, and `loadClients()` refresh behaviour.
4. Ensure the API helper’s tenant injection still covers every call (no manual `tenant_id` reintroduced).

### 3. CSV Export Fix
1. Replace the current `api.get('/contacts/export.csv')` usage with a helper that can return a raw `Response`:
   - Option A: extend `lib/api.ts` with `api.fetch(path, opts)` that skips JSON parsing and returns the `Response`.
   - Option B: call `fetch` directly after manually attaching the bearer token from Supabase (still need tenant injection—either append manually here or enhance helper to support binary responses).
2. Once a `Response` object is available, stream the blob as before and handle HTTP errors explicitly.
3. Guard for missing tenant/session; show a `toast.error` if export cannot proceed.

### 4. OAuth Launch Adjustments
1. In `sdk/connectionsClient.ts`, add a way to skip tenant query injection for `/oauth/...` endpoints:
   - Extend `api.get` signature to accept `{ includeTenant?: boolean }` (default true). When false, skip query injection.
   - Update OAuth calls to set `includeTenant: false` so `/oauth/{provider}/login/start` receive clean URLs.
2. Verify no other calls rely on the old behaviour; adjust tests accordingly.

### 5. Regression & Validation
1. Run `npm run build` (ensures TypeScript + bundler succeed).
2. Manual smoke checklist (with production env vars):
   - Login, validate `/me` and dashboard calls (ensure network requests have exactly one `tenant_id`).
   - Trigger Square import; watch network tab for `contacts.import.square` & backfill endpoints, confirm new clients appear.
   - Trigger Acuity import (mock or live) and confirm the job fires.
   - Export contacts; confirm CSV downloads successfully.
   - Launch OAuth for Square/Acuity/Google; verify redirect works (no query errors).
   - Exercise Messages (history fetch, send, follow-ups), Agenda (create task, sync calendar), Inventory (sync, merge), Settings (save).
3. Capture console/network logs for Square/Acuity import, export, and OAuth flows for handoff.

### 6. Deliverables
- Code updates with tenant cleanup, restored import logic, CSV export fix, and OAuth adjustments.
- Validation notes + screenshots/logs showing successful imports/exports/OAuth.
- Updated documentation/changelog if required.

---

## Post-work Checklist
- `git status` clean except intended files.
- Optional: `npm run lint` & `npm run test` (if suites exist).
- Prepare summary for release notes (include tenant duplication fix & import/export restorations).
