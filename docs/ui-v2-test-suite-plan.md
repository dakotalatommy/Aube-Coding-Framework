# UI V2 Launch Test Suite Plan

## Goal
Provide full end-to-end and integration test coverage for the critical V2 flows to ensure tenant-aware authentication, imports, messaging, and AI-driven tools behave like the legacy UI.

## Test Targets
1. Authentication bootstrap
2. Dashboard data fetches
3. Client import/export
4. Messaging + follow-up drafting
5. AskVX chat
6. BrandVZN image edit
7. Inventory sync + merge
8. Settings save
9. Contacts export
10. Integrations/OAuth status

## Pre-requisites
- Supabase project credentials available via environment variables
  - `SUPABASE_PROJECT_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TEST_TENANT_ID`
  - Optionally `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` for sign-in tests
- Backend base URL (e.g., `API_BASE_URL=https://api.brandvx.io`)
- Ability to run scripts with network access
- If running against production, use a dedicated test tenant with non-sensitive data

### Token Strategy
- Use the Supabase service-role key to mint JWT tokens on demand for tests. The suite can call the Supabase admin API (`auth.admin.createUser`, `auth.admin.generateLink`) or sign in via REST (`/token?grant_type=password`) with the service role to obtain an access token. Store the token per test run and attach it to each API call as `Authorization: Bearer <token>`.
- Tenant ID is required for almost all endpoints. Provide it via query string (GET) or JSON body (POST) as specified below when the helper isn’t in play.

## Test Cases

### 1. Auth Bootstrap
- **Setup**: Generate JWT using service-role key representing a known test user.
- **Steps**:
  1. `GET /auth/v1/user` (Supabase) to confirm token validity.
  2. `GET /me` with bearer token.
  3. Verify response includes `tenant_id` and user profile data.
  4. Cache `tenant_id` for subsequent tests.
- **Assertions**:
  - HTTP 200
  - JSON contains `tenant_id`, `email`, `roles` etc.

### 2. Dashboard Data Fetches
- **Endpoints** (GET + `tenant_id` query):
  - `/admin/kpis`
  - `/metrics`
  - `/cadences/queue`
  - `/contacts/list?limit=4`
  - `/referrals/qr`
  - `/followups/candidates?scope=reengage_30d`
- **Assertions**:
  - HTTP 200
  - Expected keys present (e.g., KPI metrics, agenda items)

### 3. Client Import + Backfill
- **Square**:
  1. POST `/ai/tools/execute` with payload `{ name: 'contacts.import.square', params: {}, require_approval: false, idempotency_key: ... }`.
  2. POST `/integrations/booking/square/backfill-metrics` to refresh revenue metrics.
- **Acuity**:
  1. POST `/integrations/booking/acuity/import` with `{ since: '0', until: '', cursor: '' }`.
- **Assertions**:
  - HTTP 200
  - Response `imported` count >= 0
  - No `error` keys

### 4. Messaging & Follow-Up Drafting
- **Steps**:
  1. GET `/contacts/list` (ensure data available).
  2. GET `/messages/list` (history).
  3. POST `/followups/draft_batch` with payload `{ tenant_id, scope: 'reengage_30d', template_id: 'reengage_30d' }`.
  4. Poll `/followups/draft_status?tenant_id=...` until status is `ready` or `pending`.
- **Assertions**:
  - Draft response includes `status`, `job_id`/`todo_id` values.

### 5. AskVX Chat
- **Steps**:
  1. POST `/ai/chat/raw` with `{ session_id: <test session>, messages: [{ role: 'user', content: 'How do I import contacts?' }] }`.
  2. Confirm response contains `text` and optional `suggestions`.
- **Assertions**:
  - HTTP 200
  - Response contains non-empty `text` field.

### 6. BrandVZN Image Edit
- **Steps**:
  1. Provide base64-encoded image fixture.
  2. POST `/ai/tools/execute` with `{ name: 'image.edit', require_approval: false, params: { inputImageBase64: ..., prompt: 'Make it brighter', preserveDims: true } }`.
- **Assertions**:
  - HTTP 200
  - JSON contains `data_url` or `preview_url`.

### 7. Inventory Sync & Merge
- **Steps**:
  1. GET `/inventory/metrics` to ensure data.
  2. POST `/inventory/sync` with `{ provider: 'square' }`.
  3. POST `/inventory/merge` with `{ strategy: 'sku_then_name' }`.
- **Assertions**:
  - Sync returns `status: queued` (or similar) with job/todo info.
  - Merge returns success and triggers toasts/updates.

### 8. Settings Save
- **Steps**:
  1. GET `/settings` to read current state.
  2. POST `/settings` with payload mirroring the UI (profile, business, notifications, quiet_hours, etc.).
  3. GET `/settings` again to confirm persistence.
- **Assertions**:
  - POST returns 200.
  - Subsequent GET reflects updated fields.

### 9. Contacts Export
- **Steps**:
  1. GET `/exports/contacts?tenant_id=<tenant>` with Accept `text/csv`.
  2. Assert response is 200 and includes known header row.
- **Assertions**:
  - Response body begins with `contact_id,email_hash,...` etc.

### 10. Integrations/OAuth Status
- **Steps**:
  1. GET `/integrations/status`.
  2. GET `/oauth/square/login?return=workspace` (should return `url`).
  3. GET `/oauth/acuity/login?return=workspace`.
- **Assertions**:
  - Status endpoint includes connected providers map.
  - OAuth endpoints return `url` fields; ignore actual redirects.

## Suggested Test Structure
- Use a test runner (e.g., Jest + supertest, or Playwright for E2E) that can read env vars.
- Implement helper to obtain access token via Supabase service-role key at the start, store `tenant_id` globally.
- Wrap each test in tenant-safe operations (cleanup if needed).

## Deliverables for Implementing Team
- Test suite harness with helpers:
  - `getAccessToken()` – uses service role to mint JWT for test user or to impersonate test tenant.
  - `apiRequest(method, path, { body?, query? })` – attaches bearer token, tenant id.
- A spec per test case, with assertions and logging of backend responses for debugging.
- Instructions on running tests (`npm run test:e2e` or similar) and env templates.

---

## Prompt for Execution Session
```
You are tasked with implementing the test scenarios outlined in docs/ui-v2-test-suite-plan.md. Set up helper utilities to mint Supabase access tokens via the service role, exercise each endpoint listed with the expected tenant context, and record pass/fail logs. Keep tests isolated to a dedicated tenant and follow the validation notes in the plan.
```
