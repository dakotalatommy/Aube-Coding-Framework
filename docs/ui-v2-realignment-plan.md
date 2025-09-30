# UI V2 → Backend Realignment Plan

This checklist restores the V2 operator UI so it behaves identically to the legacy shell when talking to Supabase and the BrandVX API. Follow the steps in order. Do not skip validations; each stage protects the downstream work.

## 0. Prerequisites
- Use the production env values provided in this session (`VITE_*`, `BACKEND_BASE_URL`, Supabase keys, etc.).
- Work from `apps/operator-ui` unless a step specifies the backend repo.
- Ensure `npm install` has been run.
- Whenever a step says *inspect legacy*, reference `apps/operator-ui/src/AppLegacy.tsx` and `apps/operator-ui/src/lib/api.ts`.

## 1. Auth Bootstrap Parity
1. Compare `apps/operator-ui/src/AppLegacy.tsx` bootstrap to `apps/operator-ui/src/v2/App.tsx`.
2. Update `v2/App.tsx` so this sequence is exact:
   - Immediately after `supabase.auth.getSession()` resolves with a session, call `api.get('/me')`.
   - Persist `tenant_id` to `localStorage['bvx_tenant']` before requesting any tenant-scoped endpoint.
   - If `/me` fails or `tenant_id` is missing, surface a console warning and block tenant-scoped fetches until resolved (set empty state + retry once the ID arrives).
   - Ensure logout and session-clear follow legacy behaviour (remove tenant, reset splash guards, redirect to `/login`).
3. Remove any duplicate dashboard fetches that race before tenant resolution.
4. Make sure `hasBootedRef` flips true both when a session exists and when there is no session so splash never masks `/login`.
5. Lay down concise `console.info` logs for: session creation, `/me` response, tenant source, and bootstrap completion. Match the legacy log style (`[bvx:auth] ...`).

## 2. API Helper Consistency
1. Audit `apps/operator-ui/src/lib/api.ts` vs the legacy file.
2. Confirm the helper always attaches `Authorization: Bearer <token>` **and** a `tenant_id` parameter/body field.
3. Restore any functionality that diverged (timeouts, retry to prod fallback, Sentry breadcrumbs).
4. Ensure helper exports identical signature so components need no rewiring.

## 3. Component Endpoint Alignment
For each module listed below, check the endpoints and payloads against the execution docs (`docs/ui-v2-execution-plan.md`, `docs/ui-v2-feature-map.md`, `docs/ui-v2-tenant-auth-fix.md`) and the legacy implementation. Fix every mismatch.

| Module | File(s) | Required Endpoints |
| --- | --- | --- |
| Dashboard | `apps/operator-ui/src/v2/App.tsx` | `/admin/kpis`, `/metrics`, `/cadences/queue`, `/contacts/list`, `/referrals/qr`, `/followups/candidates` |
| Agenda | `v2/components/agenda.tsx` | `/dashboard/agenda`, `/calendar/list`, `/todo/ack`, `/todo/create`, `/calendar/sync` |
| Messages | `v2/components/messages.tsx` | `/messages/list`, `/followups/draft_status`, `/followups/enqueue`, `/settings`, `/integrations/status` |
| Clients | `v2/components/clients.tsx` | `/contacts/segments`, `/contacts/list`, `/contacts/export.csv`, `/integrations/refresh`, `/onboarding/analyze` |
| Inventory | `v2/components/inventory.tsx` | `/inventory/metrics`, `/inventory/items`, `/inventory/merge`, `/inventory/sync` |
| Settings | `v2/components/settings.tsx` | `/settings`, `/integrations/status`, `/settings` POST |
| Notifications/Header | `v2/components/dashboard-header.tsx`, `v2/components/notification-dropdown.tsx` | `/notifications`, `/integrations/status` |

Steps:
1. Replace any direct `fetch` calls with the shared `api.*` helper.
2. Normalize query params/body shapes to match the backend (ensure `tenant_id` is not double-appended).
3. Reinstate legacy error handling: `toast.error`, `console.warn`, and Sentry breadcrumb calls.
4. Smoke each module in dev to confirm no request returns 401/422.

## 4. OAuth & Callback Diagnostics
1. In `v2/components/sign-in.tsx` and `v2/components/sign-up.tsx`, wrap `supabase.auth.signInWithOAuth` with detailed logging:
   ```ts
   const { data, error } = await supabase.auth.signInWithOAuth(...)
   console.info('[bvx:oauth] response', { data, error })
   ```
2. If `data?.url` is falsy, display a user-facing error and keep the button enabled again.
3. Align `/auth/callback` (v2) with legacy: `exchangeCodeForSession`, sanitize URL, broadcast auth ready, redirect.
4. Test Google login on production origin and capture the log output for debugging future issues.

## 5. Validation Checklist
1. `npm run build` (from `apps/operator-ui`).
2. Manual flows (production env values):
   - Sign in with email/password → land on workspace.
   - Sign in with Google → confirm Supabase returns redirect URL and tenant stored.
   - Verify `/me` called once after login and all dashboard endpoints succeed.
   - Navigate through Agenda, Messages, Clients, Inventory, Settings; watch network calls for 200s.
3. Logout → ensure tenant cleared, `/login` reachable without splash.
4. Bonus: run `npm run test:e2e` if Playwright suite is kept current.

## 6. Deliverables
- Updated TypeScript/React files per steps above.
- Console logs or screenshots demonstrating successful login and populated dashboard.
- Summary of any backend/API discrepancies uncovered during the pass.

