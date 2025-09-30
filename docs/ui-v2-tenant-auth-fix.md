# UI V2 Tenant & Auth Recovery Plan

This document captures exactly what must be done to realign the v2 operator UI with the backend expectations. Hand this to the execution session and keep this tab open to track progress.

## 1. Guardrails & Context
- **Goal**: restore production parity with legacy UI auth/tenant behaviour.
- **Current regression**: every dashboard API call returns `422` because `tenant_id` query parameter is missing. Tenant never makes it from Supabase session → localStorage → API URL.
- **Do _not_** remove JWT/Bearer logic we already added; JWT stays. We are re-introducing tenant id in addition to the token.

## 2. Required Code Changes

### 2.1 `apps/operator-ui/src/v2/App.tsx`
1. Inside the initial `useEffect` that calls `supabase.auth.getSession()`, after session success, call `api.get('/me')`.
2. On success, extract `tenant_id` and persist: `localStorage.setItem('bvx_tenant', tenantId)`.
3. When no session or `/me` fails, explicitly `setSession(null)` and `setShowSplash(false)` to avoid infinite splash.
4. After storing tenant id, trigger a refresh of dashboard data (`fetchDashboardData(tenantId)`). Make sure subsequent calls reuse the same id.

### 2.2 `apps/operator-ui/src/lib/api.ts`
1. After resolving the Authorization header, resolve tenant id: `const tenantId = await getTenant()`.
2. If tenant id is truthy, ensure every request includes it:
   - For GET/DELETE: append to query string (respect existing `?`).
   - For POST/PUT/PATCH with JSON body: merge `{ tenant_id: tenantId }` unless caller already passed it.
3. Keep behaviour when tenant is missing (demo mode) — send request as-is.
4. Optional: add debug log when tenant id is injected to ease future tracing.

### 2.3 Dashboard data helpers
1. Confirm `fetchDashboardData` passes the tenant id to every request (kpis, metrics, cadences/queue, contacts/list, referrals/qr, followups/candidates). With step 2.2 the API layer should do it automatically, but if there are manual URL strings, convert them to `api.get(/endpoint)` so the helper handles injection.
2. Verify no component manually builds URLs with tenant id removed.

### 2.4 Smoke the rest of the UI
1. `/ask`, `/messages`, `/agenda`, `/settings` etc. — look for any direct `fetch` usage or hard-coded URLs that bypass `api`. Switch them to `api` helper if needed.
2. Confirm `bvx_tenant` is removed on logout (already handled by `WorkspaceShell`; keep as-is).

### 2.5 Remaining direct fetch conversions (new)
1. `apps/operator-ui/src/pages/Billing.tsx`
   - Replace both `fetch(https://api.brandvx.io/billing/config)` calls with `api.get(/billing/config)`.
   - Keep existing fallback logic for missing publishable key.
2. `apps/operator-ui/src/sdk/connectionsClient.ts`
   - Replace the fallback `fetch` that hits `/api/oauth/${provider}/start` with `api.get` (or `api.post` if required) so Authorization + tenant_id are injected.
   - Remove hardcoded `X-User-Id` / `X-Role` headers and manual URL assembly.

## 3. Validation Checklist
1. `npm run build` succeeds locally with Supabase envs exported.
2. Run the UI locally (or hit the preview) and sign in:
   - Verify `/auth/v1/token` and `/me` return 200.
   - Check localStorage contains `bvx_tenant`.
3. On `/workspace`, confirm all data calls return 200 (no 422) and dashboard populates.
4. Navigate between tabs — the splash should only appear once.
5. Hard refresh to ensure the cached tenant id persists and auto-login works.

## 4. Deploy Steps (unchanged)
1. `set -a; source deploy/pages-env.txt; set +a; cd apps/operator-ui && npm run build`
2. `npx wrangler pages deploy apps/operator-ui/dist --project-name=brandvx-operator-ui --commit-dirty=true`
3. Purge cache: `curl -X POST https://api.cloudflare.com/client/v4/zones/<zone_id>/purge_cache -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "Content-Type: application/json" -d {purge_everything:true}`

---

## Prompt for execution session
```
You are handed off to continue the tenant/auth recovery plan in docs/ui-v2-tenant-auth-fix.md. Read the file first.
Important: the work in App.tsx, api.ts, SupportBubble.tsx, Contacts.tsx, Share.tsx, and v2/components/clients.ts is already completed—do not redo it.

Your tasks:
1. Confirm the existing diffs match the plan (no regressions).
2. Convert the remaining direct fetch calls in Billing.tsx and sdk/connectionsClient.ts to use the api helper.
3. Run `npm run build` with envs from deploy/pages-env.txt to verify the changes compile.
4. Do not deploy; report back with git diff, build output, and verification notes.
5. Ask for clarification before deviating.
```
