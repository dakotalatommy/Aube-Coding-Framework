# BrandVX Platform Guide (Engineering & Ops)

Audience: senior engineers and operator/owner stakeholders who need an authoritative reference on the BrandVX platform. This document combines architecture, onboarding context, integration details, security policies, observability, and runbook commands in one place.

---

## 1. Executive Snapshot

**Mission**: BrandVX automates lead nurture, scheduling, content, and AI co-pilot workflows for beauty professionals (“operators”).

**Deployment Targets**
- **Frontend**: Vite/React app served via Cloudflare Pages at `https://app.brandvx.io`.
- **Backend**: FastAPI service on Render at `https://api.brandvx.io` (Dockerized, Postgres + Redis). 
- **Data**: Supabase Postgres (RLS enforced via session GUCs), Supabase Storage buckets, Redis Cloud cache.
- **AI**: OpenAI Responses API (project `proj_bmbO50HYa0nZytjfnnNoqMkU`).

**Core Components**
- `apps/operator-ui` – SPA workspace for operators (AskVX chat, KPI dashboard, onboarding, cadences, inventory, calendar, support).
- `src/backend/app` – FastAPI monolith handling auth, integrations, jobs, AI orchestration, support, referrals, metrics.
- `db/` – SQL migrations + Supabase policies.
- `docs/` – operational references (including this guide).

---

## 2. Frontend Deep Dive (`apps/operator-ui`)

### 2.1 Stack & Entry Points
- Vite + React + TypeScript.
- Routing: `App.tsx` uses React Router with lazy-loaded routes under `pages/`.
- Bootstrapped in `main.tsx` (analytics + Sentry + Supabase session warmup).

### 2.2 Layout & Navigation
- `components/WorkspaceShell.tsx`
  - Auth gating: fetches `/me` to confirm Supabase JWT, enforces onboarding progress, triggers beta modal.
  - Hosts navigation (left sidebar), AskVX dock, support bubble, toast provider, modals.
  - Manages workspace panes via router query (`?pane=dashboard` etc.).

- Navigation items include Dashboard, AskVX, Messages, Contacts, Calendar, Cadences, Inventory, Approvals, Integrations.

### 2.3 Feature Modules
- **Onboarding**
  - `components/OnboardingStepper.tsx`: 5-step progress experience, uses `track` events, persists to `/settings`.
  - `lib/guide.ts`: driver.js tours for workspace, onboarding, AskVX, Vision, etc. Coordinates AskVX prefill events and founder slides.
  - `onboarding/` scenes: per-step flows (business basics, connections, etc.), integrate with Supabase & backend endpoints.

- **Dashboard (`pages/Dashboard.tsx`)**
  - Fetches `/metrics`, `/cadences/queue`, `/funnel/daily`, `/onboarding/analyze`.
  - Renders KPI cards (Time Saved, Usage Index, Revenue, Referrals) plus quick start and referral share card.
  - CTA: share QR, referral copy, plan upgrade buttons.

- **AskVX (`pages/Ask.tsx`)**
  - Maintains chat session via localStorage `bvx_chat_session`.
  - Calls `/ai/chat/raw` to generate responses, streaming simulation via timer chunking.
  - Tracks analytics events for prompt submission, stream start/finish, errors.
  - Handles strategy document generation, TrainVX updates, onboarding flows (insights & strategy prefill events).

- **Cadences (`pages/Cadences.tsx`)**
  - Polls `/cadences/queue`, `/followups/draft_status` to display follow-up pipeline.
  - Initiates drafts via `/followups/draft_batch` and tracks job status.

- **Calendar (`pages/Calendar.tsx`)**
  - Triggers sync jobs (`/calendar/sync`) and polls `/jobs/{id}`.
  - Displays deduped events from `/calendar/events`.

- **Inventory (`pages/Inventory.tsx`)**
  - Kicks off `/inventory/sync`, polls job IDs, renders summary from `/inventory/metrics`.

- **Support bubble (`components/SupportBubble.tsx`)**
  - Links to support form (modal) hitting `/support/send`.

- **Referrals**
  - Dashboard share card triggers `/referrals/qr` to fetch QR PNG.

### 2.4 Shared Libraries
- `lib/api.ts`
  - Axios wrapper with Render + Cloudflare base URLs, handles Supabase session token injection.
  - Retries API calls with fallback base when configured (prod vs staging).

- `lib/analytics.ts`
  - PostHog wrapper (init, track, identify, feature flag overrides).

- `lib/guide.ts`
  - Central driver.js configuration (tour steps, AskVX prefill events, navigation triggers, founder slide validation).

- `lib/supabase.ts`
  - Supabase client for auth, profile retrieval, storage.

### 2.5 State, Storage & Security
- Predominantly React hooks; no global state manager.
- Persistent keys: `localStorage` entries prefixed `bvx_` (tour state, chat cache, quick start progress).
- Supabase session stored but revalidated on load; `WorkspaceShell` clears stale data on logout.
- Sensitive tokens never stored in frontend (OAuth flows go through backend).

### 2.6 Build & Test Commands
- `npm install` (from `apps/operator-ui`).
- `npm run dev` – start dev server at `http://localhost:5173`.
- `npm run build` – production build in `dist/`.
- `npm run preview` – preview build.
- `npm run lint` – lint check.
- `npm run test:e2e` – Playwright smoke tests (requires build + `vite preview`). Expected output: pass summary with `✔` marks for landing/workspace tests.

---

## 3. Backend Deep Dive (`src/backend/app`)

### 3.1 Framework
- FastAPI app (`main.py`) with modular organization.
- Authentication: Supabase JWT via `get_user_context`, verifying tenant & role, applying RLS GUCs (`SET LOCAL app.tenant_id`, `app.role`).
- Database: SQLAlchemy + psycopg (Supabase Postgres). Most writes done via raw SQL with explicit tenant scoping.
- Background Jobs: job table + helper functions (`jobs.py`). Worker expected to poll jobs table (not bundled by default).

### 3.2 Route Families (selected)
- **Onboarding & Settings**
  - `/settings` GET/POST: stores JSON config (quiet hours, brand profile, onboarding step index, subscription status).
  - `_complete_step` logs onboarding progress in `onboarding_progress` table.

- **AskVX**
  - `/ai/chat/raw`: orchestrates AI chat with GPT-5, writes transcripts to `askvx_messages`, updates metrics.
  - `/ai/chat/session/new`, `/ai/chat/sessions`, `/ai/chat/history` manage chat sessions (id generation, retrieval).
  - `/ai/strategy` & `/ai/onboarding` endpoints generate plan artifacts (`onboarding_artifacts`).
  - Tools integration via `/tools/execute`, with approvals gating.

- **Cadences**
  - `/followups/candidates`, `/followups/draft_batch`, `/followups/enqueue`, `/cadences/queue`, `/cadences/start`, `/cadences/stop` manage follow-up pipeline.
  - Emits metrics via Prometheus counters and PostHog events.

- **Calendar & Inventory**
  - `/calendar/sync`, `/inventory/sync` create job records and immediately return `job_id`.
  - `/jobs/{id}` & `/jobs/{id}/result` provide status updates.
  - `/calendar/events` merges Google, Square, Acuity events and dedupes overlaps.
  - `/inventory/metrics` surfaces summary from `inventory_summary` table.

- **Support & Referrals**
  - `/support/send`: handles multipart uploads, stores files in Supabase bucket, writes `support_tickets`, triggers email stub.
  - `/referrals/qr`: generates PNG QR via Pillow + qrcode, returns CDN URL.
  - `/r/{code}`: tracked referral redirect (updates settings JSON).

- **Analytics & Metrics**
  - `/admin/kpis`: combines metrics table, counts, Prometheus counters (cache-wrapped).
  - `/metrics`: exposes Prometheus data if enabled.

- **Auth & Utilities**
  - `/me`: returns profile & gating info.
  - `/health`, `/ready`: health checks (DB, Redis, OpenAI, PostHog, Sentry, contexts).
  - `/admin/cache/clear`: clears Redis caches per scope.

### 3.3 Integrations Modules (OAuth & Token Handling)
- **Square (`integrations/booking_square.py`)**
  - Access token stored encrypted in `connected_accounts_v2.access_token_enc`.
  - Token decrypt via `decrypt_text`; `fetch_bookings` queries Square Bookings API.
  - Webhook signing: `verify_square_signature` compares HMAC SHA-256.
  - OAuth flow handled elsewhere (frontend triggers backend endpoints to exchange code, store tokens). Ensure `SQUARE_CLIENT_ID`, `SQUARE_CLIENT_SECRET`, `SQUARE_WEBHOOK_SECRET` populated.

- **Acuity (`integrations/booking_acuity.py`)**
  - Prefers OAuth Bearer; fallback to Basic (User ID + API key) if OAuth not connected.
  - `_with_conn` ensures RLS GUC before DB reads/writes.
  - `import_appointments` fetches clients + appointments, upserts contacts/appointments, logs event `AcuityImportCompleted`.
  - Webhook verification via `acuity_verify_signature` (HMAC-SHA256, base64/hex).

- **Google Calendar (`integrations/calendar_google.py`)**
  - OAuth tokens stored encrypted (access + refresh + expiry) in `connected_accounts_v2`.
  - `_ensure_access_token` refreshes token using `GOOGLE_CLIENT_ID/SECRET`.
  - Fetches events & creates events via Google Calendar API (RFC3339 timestamps).

- **Apple Calendar (`integrations/calendar_apple.py`)**
  - Placeholder (returns scaffolded data). Documented for future CalDAV integration.

- **Shopify/Square Inventory**
  - `inventory_shopify.py` & `inventory_square.py` currently return scaffold data; real API integration to be implemented (document placeholders).

- **HubSpot (`crm_hubspot.py`)**
  - Simulated CRM sync; uses `emit_event` (`CrmSyncComplete`). OAuth yet to be finalized.

- **SendGrid (`email_sendgrid.py`)**
  - Sends email via API key, using circuit breaker wrappers.
  - Webhook verification with Ed25519 signature (PyNaCl optional). Env: `SENDGRID_PUBLIC_KEY`, `SENDGRID_ACCEPT_UNSIGNED` for dev fallback.

- **Twilio (`sms_twilio.py`)**
  - SMS send via REST `Messages.json`, circuit breaker.
  - Webhook verification: HMAC-SHA1 with auth token.

- **Instagram Basic (`instagram_basic.py`)** – stub for future social posting.

### 3.4 Jobs System
- Table `jobs`: stores `id`, `tenant_id`, `kind`, `status`, `payload_json`, `result_json`, `created_at`, `updated_at`.
- Create via `create_job_record` (returns ID). Update via `update_job_record` (status + result). Worker not packaged; recommended to run worker that polls jobs table and executes `do_work(job)`.
- `/jobs/{id}`: GET status. `/jobs/{id}/result`: returns final payload.

### 3.5 Error Handling & Circuit Breakers
- `cache.py` breaker functions manage failure counts and open circuits (TTL 60s default).
- Integrations (SendGrid, Twilio) respect breaker state to avoid cascading failures.
- API responses wrap errors with sanitized detail (first 200 chars).

### 3.6 Observability Hooks
- `analytics.py` – lazy PostHog client (`ph_capture`), automatically tags events with `env`.
- `metrics_counters.py` – Prometheus counters for cache hits, AI chat usage, tool execution counts.
- `main.py` health endpoint aggregates DB, Redis, OpenAI, PostHog, Sentry status, tool/context registries.

### 3.7 Configuration via Environment Variables
- `deploy/render-env.txt` and `deploy/pages-env.txt` list production env keys.
- Key categories: AI (OpenAI), OAuth (Google, Square, Acuity, HubSpot), Messaging (SendGrid, Twilio), Analytics (PostHog, Sentry), Storage (Supabase URL/keys), Billing (Stripe price IDs), Redis, Scheduler toggles, Feature flags (`VITE_*`).

---

## 4. Database & Storage (Supabase)

### 4.1 Tenant & RLS Strategy
- Every API request sets `SET LOCAL app.tenant_id = '{tenant_uuid}'` and `app.role` (owner_admin, support, etc.).
- RLS policies rely on `current_setting('app.tenant_id')` to restrict queries.
- `db/supabase_policy_merge.sql` and `db/supabase_policy_tighten.sql` manage policies.

### 4.2 Schema Highlights
- **Operational Tables**
  - `tenants`: metadata (plan tier, subscription status, onboarding timestamps, Stripe IDs).
  - `settings`: JSON config per tenant (quiet hours, training notes, trial status, gating flags).
  - `onboarding_progress`: steps completed (step key + context).
  - `onboarding_artifacts`: stored strategy markdown, training exports, includes `kind`, `file_url`, `metadata`.
  - `jobs`: background tasks (see §3.4).
  - `activity_log`: captures major events (support submitted, plan generated, share actions).

- **AI & Messaging**
  - `askvx_messages`: conversation transcripts (role, content, metadata).
  - `trainvx_memories`: key/value stored training notes.
  - `ai_memories`: rolling memory (last session summary).
  - `messages`: outbound/inbound history with redacted body (first 256 characters), provider metadata, status.
  - `cadence_states`: depict contact progression, new columns for `queued_at`, `sent_at`, `last_status` enable analytics.

- **Scheduling & Inventory**
  - `appointments`: deduped events (connected accounts), cross-provider `external_ref` for updates.
  - `calendar_events`, `inventory_items`, `inventory_summary` track merged outputs.

- **Support & Billing**
  - `support_tickets`: entry (subject, description, status, attachments, created_by).
  - `referral_codes`, `referrals`: store referral program states (link, plan_before/after, processed timestamps).
  - `plans`, `usage_limits`: plan definitions, per-tenant caps (AI tokens, message counts, grace periods).

- **Audit & Data Safety**
  - `audit_logs`: manual interventions, data exports, approvals tracked.
  - `dead_letters`: failed provider deliveries (SMS/email) recorded with reason.
  - `events_ledger`: general event stream for cross-service logging.

### 4.3 Storage Buckets (Supabase)
- `support-uploads`: attachments from support tickets, private with signed URL access only.
- `referral-assets`: generated QR PNGs, accessible via signed URLs.
- `qr-cache`: cached QR assets (clean-up job recommended).
- `onboarding-exports`: compressed strategy docs, onboarding outputs.
- Policies: ensure only service role/key writes; public access disabled.

### 4.4 Migration & Schema Management
- Migrations reside in `db/migrations/{date}_brandvx_*.sql` (e.g., `2025-09-11_brandvx_sweep.sql`).
- Alembic also configured (`alembic/versions/`).
- Use `psql` or Supabase SQL editor to apply; maintain atomic transactions.

### 4.5 Sample Queries (Supabase SQL)
1. Time saved hours per tenant:
   ```sql
   SELECT tenant_id, (time_saved_minutes / 60.0) AS hours_saved
   FROM metrics
   ORDER BY hours_saved DESC
   LIMIT 10;
   ```
2. AskVX message volume last 30 days:
   ```sql
   SELECT tenant_id, COUNT(*) AS msg_count
   FROM askvx_messages
   WHERE created_at >= extract(epoch from now())::int - 30*86400
   GROUP BY tenant_id
   ORDER BY msg_count DESC;
   ```
3. Onboarding progress summary:
   ```sql
   SELECT tenant_id,
          COUNT(*) FILTER (WHERE step_key = 'train_vx') AS train_steps,
          MAX(completed_at) AS last_completed
   FROM onboarding_progress
   GROUP BY tenant_id;
   ```

---

## 5. External Integrations & OAuth/Token Flows

### 5.1 Square OAuth
1. Frontend initiates Square OAuth (`connect.squareup.com/oauth2/authorize`) via backend-provided link (client ID & scopes from env).
2. On callback, backend exchanges code for access token. Token encrypted (`encrypt_text`) and stored in `connected_accounts_v2`.
3. API usage uses Bearer header; refresh tokens handled via Square endpoint when needed.
4. Webhooks (if enabled) must include signature header verified against `SQUARE_WEBHOOK_SECRET`.
5. Redaction: square customer IDs stored, but personal info hashed (contact_id). No raw card data handled.

### 5.2 Acuity OAuth / API Keys
1. Attempt OAuth first: stored Bearer tokens in `connected_accounts_v2`. Refresh logic TBD (Acuity tokens often long-lived).
2. Fallback Basic auth uses `ACUITY_USER_ID` + `ACUITY_API_KEY` from env.
3. Webhook signature via HMAC-SHA256 with API key; accept both base64 and hex.
4. Data Redaction: contacts stored with hashed email/phone; baseline sanitized before storing.

### 5.3 Google Calendar OAuth
1. Authorization code flow using `GOOGLE_CLIENT_ID/SECRET`. Redirect handled server-side.
2. Stored tokens encrypted; `_ensure_access_token` refreshes using refresh token.
3. API calls use Bearer tokens; event data stored with sanitized titles/IDs.
4. Redaction: we do not store attendee emails; only event start/end, status, summary.

### 5.4 HubSpot OAuth (Planned)
- Infrastructure ready (`crm_hubspot.py` stub). Provide client ID/secret, scopes in env.
- Upsert pipeline includes idempotency key hashed from email/phone; data stored in HubSpot not Supabase.

### 5.5 SendGrid API & Webhooks
- Outbound: requires `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`. `sendgrid_send_email` builds both HTML + text fallback.
- Webhook verification per Ed25519 signature; `SENDGRID_PUBLIC_KEY` must be base64 encoded. `SENDGRID_ACCEPT_UNSIGNED` only in dev.
- Redaction: email content stored limited (payload stored in DB as redacted summary). Avoid logging raw HTML outside provider request.

### 5.6 Twilio SMS
- Requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
- Payload redacted: `messages` table stores `body_redacted` (first 256 chars), not full message history.
- Webhook signature uses auth token; no fallback to accept unsigned except dev logs.

### 5.7 Stripe Billing
- Stripe live secret `STRIPE_SECRET_KEY` and plan price IDs (47/97/127/147). Subscription status stored in `tenants.plan_tier`, `settings` JSON.
- Referral upload endpoint updates `referrals` table and toggles plan upgrade.
- Webhook integration to be confirmed (ensure signing secret `STRIPE_WEBHOOK_SECRET` is set). Document event processing, test in staging.

### 5.8 Supabase Storage
- Access via service role key (server only). Browser uses anon key for public data reads.
- Policies enforce tenant scoping by path (prefix with tenant UUID).

### 5.9 Additional Providers
- `instagram_basic.py`: stub for future IG Basic Display API (document required scopes). 
- `calendar_apple.py`: placeholder; future integration should respect Apple CalDAV auth tokens stored per tenant.

---

## 6. Security, Redaction & Compliance Policies

### 6.1 PII Handling
- Contacts table stores hashed email (`email_hash`) and phone (`phone_hash`). Use hashed values for lookups; do not store raw PII.
- Messages stored with `body_redacted` (256 char max). Full transcripts avoided unless necessary (AskVX messages may include text but only operator content).
- Support ticket attachments stored in private bucket; access via signed URLs only. Expire URLs after use.
- Analytics events must avoid raw PII (only hashed IDs, step names, or aggregated metrics). Confirm `track` payloads exclude emails, phone numbers.

### 6.2 Logging & Monitoring
- Avoid logging tokens or secrets. Most logging disabled or truncated to 200 chars.
- Sentry sanitized to omit contact data; extends `beforeSend` with tenant tag only.
- Access tokens encrypted at rest via `encrypt_text` (uses AES + env secret).

### 6.3 API Security
- JWT verification ensures matching tenant & audience. `ALLOW_WEAK_JWT` should be `0` in production.
- Rate limiting via Redis; default multiplier per tenant stored in Redis key `tenant:{id}:rl_multiplier`.
- Circuit breaker opens after repeated failures to prevent provider rate-limit blowups.

### 6.4 Storage Policies
- Supabase storage buckets configured private; only service role writes.
- Document bucket policies in Supabase console; ensure `support-uploads` restricts to service role for uploads, signed URL for reads.

### 6.5 Data Retention
- AskVX messages: plan for 90-day purge script (cron). Document requirement to run `db/cron/askvx_purge.sql` (TBD).
- Dead letters/audit logs stored indefinitely; consider rotation policy.

---

## 7. Observability & KPIs

### 7.1 PostHog (Analytics)
- Events listed in §2.5 and `docs/observability-summary.md`.
- Dashboard Suggestions:
  - Activation: `onboarding.stepper_open` -> `onboarding.step_completed` (time-to-value histogram).
  - AI Usage: `ask.prompt_submitted` vs `ask.response_error` per tenant.
  - Cadence Success: ratio of `cadence.message_sent` / `cadence.message_failed` segmented by template.
  - Referral Engagement: `referral.copy`, `referral.qr.download` counts.

### 7.2 Sentry
- Monitor Issues/Performance for backend (FastAPI) and frontend (React) releases.
- Setup alerts: new issue or >5 errors/min threshold.
- Use session replays to debug workspace glitches.

### 7.3 Prometheus Metrics
- Available counters: `brandvx_cache_hits_total`, `brandvx_cache_misses_total`, `brandvx_scheduler_ticks_total`, `ai_chat_used_total`, `insights_served_total`, etc.
- Expose via `/metrics` (if not proxied behind auth). Use Grafana or Prometheus server to scrape.

### 7.4 KPI Targets for Launch
- Activation: number of tenants completing onboarding (check `onboarding_artifacts`, `activity_log` for `tour_completed`).
- Usage: AskVX messages per tenant, follow-up drafts generated vs approved, calendar syncs.
- Support: support tickets per week, average resolution time (difference between `created_at` and last status change).
- Monetization: trial-to-paid conversions (Stripe plan_tier changes), referral code redemptions.
- Retention: time saved minutes trending upward, TrainVX memory updates, share prompt conversions.

### 7.5 Verification Commands
- PostHog capture test:
  ```bash
  curl -s -o /tmp/ph_resp.json -w "%{http_code}\n" \
    https://app.posthog.com/capture/ \
    -H 'Content-Type: application/json' \
    -d '{"api_key":"<phc_key>","event":"verify_capture","distinct_id":"ops-test","properties":{"env":"staging"}}'
  ```
  Expected output: `200`.

- Sentry test event (backend):
  ```bash
  curl -s https://api.brandvx.io/health | jq '.sentry'
  ```
  Expected output: `true` when DSN configured.

- Redis health:
  ```bash
  curl -s https://api.brandvx.io/health | jq '.redis'
  ```
  Expect `"ok"`. If `"disabled"` or `"error"`, inspect provider.

- Prometheus metrics (if exposed):
  ```bash
  curl -s https://api.brandvx.io/metrics | head
  ```
  Output begins with `# HELP` lines.

---

## 8. Operational Runbooks

### 8.1 Deployment Workflow
1. `python3 scripts/preflight_env_parity.py` – ensures env parity between local, Render, Cloudflare.
2. `bash scripts/deploy_all.sh` – builds operator-ui, deploys to Cloudflare Pages, triggers Render deploy, purges Cloudflare cache.
3. Verify:
   - Frontend: `https://app.brandvx.io` loads, PostHog host correct.
   - Backend: `curl https://api.brandvx.io/health` returns 200 with subsystem statuses.
   - Run Playwright smoke tests (`npm run test:e2e`).
4. Notify team on success, attach Sentry release name.

### 8.2 Post-Deploy Smoke Checklist
- Login as sample tenant; check Dashboard, AskVX prompt (should return response), Onboarding stepper ensures step events are tracking.
- Trigger job (e.g., `/inventory/sync`) and ensure job status transitions from `pending` -> `running` -> `completed`.
- Submit support ticket with attachment; confirm file arrives in Supabase storage and support ticket record created.
- Generate referral QR and verify PNG accessible.

### 8.3 Job Monitoring
- Query: `SELECT id, tenant_id, kind, status, updated_at FROM jobs ORDER BY updated_at DESC LIMIT 20;`
- Stuck jobs (status `running` >15 min) – inspect logs, update status via admin script if needed.
- Use `/jobs/{id}` API for UI polling (should return `status`, `progress`, `result`).

### 8.4 Support Flow
- Frontend form posts to `/support/send` with multipart (subject, category, description, file).
- Backend writes `support_tickets`, `support-uploads` bucket.
- Activity log entry `support.created` added.
- Email stub currently logs or uses SendGrid depending on configuration.
- Ops team should monitor `support_tickets` table or build supabase view for triage.

### 8.5 Incident Response
- If external provider fails (e.g., Twilio), circuit breaker opens after 3 failures. Check `dead_letters` table for details.
- For AI outages (OpenAI), `/health` shows `openai` error; set feature flag to disable AskVX if needed.
- Redis outage triggers fallback to in-memory cache; expect performance degradation but service remains up.

---

## 9. Case Study & Analytics Toolkit

### 9.1 Data Sources
- **Quantitative**
  - `askvx_messages`, `onboarding_artifacts`, `trainvx_memories`, `jobs`, `inventory_summary`, `calendar_events`, `metrics`, `cadence_states`.
  - Analytics: PostHog events, Prometheus counters, activity log.
  - Billing: `tenants.plan_tier`, `usage_limits`, Stripe events (future webhook).

- **Qualitative**
  - `support_tickets.description`, attachments (with PII redaction before sharing).
  - AskVX transcripts (with operator consent, redact names).
  - Onboarding notes (trainVX memory values).

### 9.2 Case Study Outline
1. **Profile**: tenant vertical, plan tier, onboarding timeline.
2. **Activation**: steps completed, time from signup to first strategy doc.
3. **Usage Patterns**: AskVX conversations/week, follow-up drafts, calendar sync frequency.
4. **Outcomes**: time saved hours, referral conversions, revenue uplift proxy, support ticket resolution time.
5. **Qualitative Insights**: curated support stories, AskVX success anecdotes (anonymized).
6. **Next Steps**: recommended automations or integrations to enable.

### 9.3 Data Extraction Workflow
- Use Supabase service role via `SUPABASE_SERVICE_ROLE_KEY` in trusted environment.
- Example data pull script (Python snippet):
  ```python
  import requests
  from datetime import datetime, timedelta

  SUPABASE_URL = 'https://dwfvnqajrwruprqbjxph.supabase.co'
  SERVICE_ROLE = os.environ['SUPABASE_SERVICE_ROLE_KEY']

  headers = { 'apikey': SERVICE_ROLE, 'Authorization': f'Bearer {SERVICE_ROLE}' }
  since = int((datetime.utcnow() - timedelta(days=30)).timestamp())
  resp = requests.get(f'{SUPABASE_URL}/rest/v1/askvx_messages',
                      headers=headers,
                      params={'select':'tenant_id,created_at','created_at':'gte.'+str(since)})
  data = resp.json()
  ```
- Anonymize transcripts: replace contact names with hashed IDs using `hashlib.sha256(name.encode()).hexdigest()[:10]`.
- Document attachments: generate signed URLs with Supabase SDK, expire after audit.

---

## 10. Testing & QA

### 10.1 Automated Tests
- Run from repo root: `pytest` – covers API flows (support, referrals, AskVX, jobs).
  - Expected summary: `== X passed, Y warnings in ZZs ==`.
- E2E: `cd apps/operator-ui && npm run build && npm run test:e2e`.

### 10.2 Manual Regression Checklist
- Onboarding stepper: complete each step, ensure state persists after refresh.
- AskVX: send prompt, receive response, generate strategy doc, save to TrainVX.
- Cadences: start follow-up, confirm queued, draft message, mark as approved.
- Calendar: trigger sync, ensure events appear without duplicates.
- Inventory: run sync, confirm metrics present.
- Support: submit ticket with attachment, confirm entry in Supabase storage.
- Referral: generate QR, open share modal, copy link.

### 10.3 Load & Performance Notes
- `k6/load_1k_users.js` simulates 1,000 concurrent users hitting API; run via `k6 run k6/load_1k_users.js` (requires k6).
- Render plan currently `free`; to handle 1k week-one users, upgrade to Render Pro and configure autoscaling.

---

## 11. Launch & Ops Checklist (Embed for convenience)

1. **Env Parity**: `python3 scripts/preflight_env_parity.py` → check for missing keys.
2. **Build & Deploy**: `bash scripts/deploy_all.sh`.
3. **Post Deploy**:
   - `curl https://api.brandvx.io/health | jq '.'`
   - Playwright smoke tests.
   - PostHog & Sentry validation (see §7.5).
4. **KPIs**: review PostHog dashboards, `/admin/kpis` output for sample tenant.
5. **Support Readiness**: ensure `support_tickets` view accessible; test email/Slack route if configured.
6. **Billing**: verify Stripe plan IDs, referral upgrade flow by submitting referral proof (test environment or coupon method).
7. **Backups**: confirm Supabase PITR or manual export scheduled.
8. **Observability**: set alerts for Redis downtime, AI costs, Sentry issues.

---

## 12. Appendix

### 12.1 Directory Map (Key Areas)
```
apps/operator-ui/
  components/         # shared UI, shell
  pages/              # routes (Dashboard, Ask, etc.)
  lib/                # api, analytics, guide
  onboarding/         # onboarding scenes
  tests-e2e/          # Playwright specs
src/backend/app/
  main.py             # FastAPI routes
  jobs.py             # job helpers
  ai.py               # AI orchestration
  analytics.py        # PostHog helper
  integrations/       # external APIs
  models.py           # SQLAlchemy models
  cache.py            # Redis cache helpers
  rate_limit.py       # rate limiting/circuit breaker
  tools.py            # tool registry
  scheduler.py        # scheduled tasks
  brand_prompts.py    # AI system prompts
  contexts.py         # AskVX contexts
  contexts_detector.py# context detection logic
```

### 12.2 Command Cheatsheet
- Start backend (dev): `uvicorn src.backend.app.main:app --reload`
- Start frontend (dev): `cd apps/operator-ui && npm run dev`
- Run lint (backend): `ruff check src/backend`
- Format (backend): `ruff format src/backend`
- Curl AskVX history: `curl -H "Authorization: Bearer <JWT>" "https://api.brandvx.io/ai/chat/history?tenant_id=<id>&session_id=<session>"`

### 12.3 Glossary
- **AskVX**: AI co-pilot chat for operators.
- **TrainVX**: memory vault storing brand facts/notes for personalizing AI responses.
- **Cadence**: automated follow-up sequence (Never Answered, Winback, etc.).
- **Onboarding artifacts**: strategy docs, exports generated during onboarding.
- **Jobs**: background tasks triggered by sync actions (calendar, inventory, follow-ups).
- **Share prompt**: referral/share CTA surfaced at milestones (e.g., 10h saved).

---

*End of guide.*
