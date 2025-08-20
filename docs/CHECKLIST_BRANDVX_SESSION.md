# BrandVX Session Reference — Master Workflows & Integrations

Authoritative checklist combining the evolved master prompt, Phase plan, and index‑card notes. Use this as the single reference while confirming implementations and workflows in this session.

## Core References
- UX LAW: `GitHub Repo Docs/User Experience.md`
- UFIS & Coherence: `GitHub Repo Docs/The Unified Field Intelligence Scale.md`
- Master Workflows: `docs/MASTER_WORKFLOWS.md`
- Phase Plan (1→4): Onboarding → Build/Integrations → Workflows/Testing → UI wiring/polish

---

## Onboarding (Finish all touchpoints)
- [x] Guided per‑tab instructions (driver.js)
- [ ] No separate mega page; track progress to 100% (define checkpoints)
- [ ] Exists as part of landing for non‑users (links from Home)
- [x] Connect Google (Calendar), Apple (ICS), Square, Acuity, HubSpot, Facebook, Instagram, Shopify (scaffolded; status surfaced)
- [x] Run analysis (time, social, financials, booking inbound). Store analysis data (summary surfaced)
- [x] Brand profile (tagline, voice, specialties); save to settings
- [x] Consent preview: 7d / 3d / 1d / 2h; Soonest vs Anytime selector (persisted)
- [x] 10‑client import with manual selection; introduce Hire/Fire
- [ ] Links to full tutorial post‑onboarding

## Messaging & Cadences
- [ ] Explain “How cadences work” (non‑technical copy)
- [x] Simulate vs send: Confirm draft → send pipeline (simulate/send present)
- [ ] Copy‑safety check pre‑send
- [ ] Quiet hours & rate limits enforced (backend available; needs surfacing)
- [x] STOP/HELP handling; audit logs (scaffolded)

## Integrations & Data Surfaces
- [x] Contacts + HubSpot sync (upsert sample works)
- [x] Calendar unified: Google/Apple + bookings merge (Square/Acuity), provider filter, last‑sync badges
- [x] Inventory: Shopify/Square items, stock, cost/price, low/out of stock, manual recompute
- [x] Inbox: FB/IG connect, readiness badges, channel filters, messages scaffold; search + date filters
- [x] Alerts/integrations/tools wired to WFs; deployed with instructions to prevent drift (Quick Actions: dedupe, low‑stock, social plan)

## Approvals
- [x] Define approvals clearly in UI and docs
- [x] Inline banners for risky actions with Approve/Reject flow (Messages, Cadences, Integrations)
- [x] Approvals page lists outcomes (basic)
- [x] Details panel with tool summary + params (incl. social plan context)

## Client Curation (Hire/Fire)
- [x] Tinder/Hinge‑style swipe/drag interactions
- [x] Stats: visits, minutes, revenue, services (basic)

## AskVX (Chat + Guidance)
- [x] Response structure: “Get Started!” buttons to exact workflows
- [x] “BrandVX is typing” animation; streaming
- [x] Floating/dockable AskVX across tabs (widget)
- [x] Chat logs selectable by session; “New session” toggle
- [ ] Voice continuity across tabs (AskVX voice: L11 vs ARC)
- [ ] Links to Discord (community) where relevant

## UI Polish & Navigation
- [ ] Move Home “Get Started” under Sign‑in to proper CTA; fix onboarding “Buy” misplacement
- [ ] Header centered; remove placeholder “ABC”
- [ ] Better separation/grouping of sections
- [ ] “Basil” background variant available
- [x] Founder + LTD pricing; referrals copy; “Join our waitlist!” CTA
- [ ] Beauty‑friendly language; hide tenant IDs; replace technical lingo (JSON arrays, IDs) with UI terms
- [x] Full UI integration for existing platform pages (scaffolded shells)

## Tutorials & Guide‑Me
- [x] Per‑tab guided instructions (driver.js) for setup & key workflows (expanded registry)
- [x] “Get Started!” popup after onboarding into guided D&M tutorial
- [x] Workflows page lists all flows with one‑click launch
- [x] Workflows tour includes Quick Actions (dedupe, low‑stock, social)

## Data, Security, Compliance
- [ ] Client appointment/convo/image/treatment history (Supabase host)
- [ ] Separate admin/public login; admin not exposed
- [ ] Restrict admin edits to secure environment (local Mac)
- [ ] HIPAA‑compliant DB path (advisory; no integration yet)

## Master Inbox (Omnichannel)
- [x] FB/IG DM & comments (scaffold), email/SMS placeholders
- [x] Filters (channel/search/date), empty/error states
- [ ] TikTok DM (plan/feasibility)

## Automation & Extras
- [ ] DM automation for Instagram (Jarvee or alternative, feasibility and safeguards)
- [ ] Inventory + product launch planning workflows
- [ ] Health check workflow (system status, metrics)
- [ ] Star disclosure action (press radial button) — define and implement

## RBAC & UX Language Layer
- [ ] Do not ask for Tenant ID; use buttons & context
- [ ] Map internal IDs/arrays to friendly language (lingo layer)

---

## Verification Pass (for this session)
- [x] Cross‑check each item against implementation (UI + API) — in progress
- [x] Add missing routes/components as needed (iterative)
- [x] Update tests: smoke/E2E for Calendar/Inventory/Onboarding, AskVX, Messaging
- [x] Keep copy non‑technical; consent‑first; guide users to success (iterative)

> Keep this document open during the session. Update checkboxes as items land.

---

## Go‑Live Checklist (Per‑Tenant)

1) Credentials & Redirects
- [ ] Populate FastAPI `.env` with production client IDs/secrets:
  - `GOOGLE_CLIENT_ID/SECRET`, `SQUARE_CLIENT_ID/SECRET`, `ACUITY_CLIENT_ID/SECRET`, `HUBSPOT_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET`, `INSTAGRAM_CLIENT_ID/SECRET`, `SHOPIFY_CLIENT_ID/SECRET`, `SENDGRID_API_KEY`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN` (if using SMS/email)
- [ ] Set `BACKEND_BASE_URL` and `FRONTEND_BASE_URL` to production URLs
- [ ] Add redirect URIs in each provider console: `${BACKEND_BASE_URL}/oauth/{provider}/callback`
- [ ] For Shopify, set `SHOPIFY_SHOP_DOMAIN`

2) Webhooks & Public HTTPS
- [ ] Expose FastAPI publicly (production domain or tunnel for staging)
- [ ] Configure provider webhooks (FB/IG, Square/Acuity, SendGrid/Twilio) to hit published endpoints
- [ ] Enable signature verification (FB/IG hub verify, Square/Acuity secrets)

3) Database & Storage
- [ ] Migrate from demo `STATE` to durable storage where needed (calendar merges, inventory snapshots)
- [ ] Confirm SQL migrations are up to date (Alemic) and tables exist

4) Tenant Flip: Demo → Live
- [ ] In `Settings`, confirm brand profile/tone/services
- [ ] Set `settings.completed = true` for the tenant via `/onboarding/complete`
- [ ] Set `providers_live` map for desired providers, e.g. `{ google: true, square: true, facebook: true, instagram: true, shopify: true }`
- [ ] Re‑run `/onboarding/analyze` and verify `connected` map and readiness flags

5) Tests & Monitoring
- [ ] Run backend tests: `PYTHONPATH=. pytest -q`
- [ ] Run E2E smoke tests (Playwright) against staging
- [ ] Verify Approvals page captures risky actions; test approve/reject
- [ ] Verify Logs/Audit endpoints and basic metrics

6) Final UX Checks
- [ ] “Guide me” flows present on Onboarding, Integrations, Inbox, Calendar, Inventory
- [ ] AskVX floating window opens and persists position/size
- [ ] Consent timing shows 7/3/1/2h; “Soonest vs Anytime” default saved
- [ ] Inbox filters (channel/search/date) work; messages appear after connecting FB/IG
- [ ] Calendar shows provider tags; Deduplicate works
- [ ] Inventory low/out stock highlighting visible; sync buttons functional
- [ ] Curation swipe/undo works; stats update

7) Security & Access
- [ ] Restrict admin routes; separate admin/public login when deploying to production
- [ ] Keep service role keys server‑only (never in browser)
- [ ] CORS set to production frontend origin(s)

Notes
- You can go live incrementally per provider using `providers_live` without flipping all at once.
- If a provider requires app review (FB/IG), keep others live while FB/IG remain in demo.

---

## UFIS Guardian — Action Plan (current pass)

Prioritized, actionable items derived from a UFIS guardian scan across H/L layers, integrations, and UX. Check items as they land; each item maps to concrete endpoints, files, and UI flows.

Status snapshot (this pass):
- [x] Workflow quick actions wired (dedupe, low‑stock, social plan) and tracked
- [x] AskVX plan runner added (sequential tool execution, approvals‑aware)
- [x] Approvals details panel (context + params) and nav badge for pending
- [x] PostHog analytics: pageviews + key events (workflows, AskVX)
- [x] `/tutorial` page added to kick off guide
- [ ] Persist inventory/calendar fully in DB (replace `STATE` reads)
- [ ] Webhook signature verification (FB/IG/Shopify/Square/Acuity)
- [ ] E2E tour execution path from AskVX (Playwright)
### P0 — Dev runbook & visibility
- [ ] Ensure local dev servers run and landing is visible
  - Frontend: `apps/operator-ui` → `npm run dev -- --host 127.0.0.1 --port 5173`
  - Backend: `uvicorn src.backend.app.main:app --host 127.0.0.1 --port 8000`
  - Verify: `http://127.0.0.1:5173/` (Landing), `GET /health`, `GET /metrics/prometheus`

### P1 — Auth: Supabase-backed sessions
- [ ] Wire Supabase Auth in UI (`Signup.tsx`, `Login.tsx`) and persist session
- [ ] Send `Authorization: Bearer <token>` on all API calls
- [ ] Backend JWT validation via Supabase JWKS (`JWT_JWKS_URL`, `JWT_AUDIENCE`, `JWT_ISSUER`)
- [ ] Redirects: signup → `/onboarding?tour=1`, finish → `/tutorial?tour=1`

### P2 — Durability: remove in‑memory scaffolds
- [ ] Create persistent tables for unified calendar events & inventory snapshots (Alembic)
- [ ] Update `/calendar/list|sync|merge` to read/write DB, not `STATE[...]`
- [ ] Update `/inventory/metrics|sync` to use DB; keep summaries per tenant
- [ ] Add minimal admin SQL checks to verify counts after sync/merge

### P3 — Caching & performance (Redis)
- [ ] Introduce cache util (Redis w/ in‑mem fallback)
- [ ] Cache hot reads with TTL and invalidate on writes
  - `GET /inventory/metrics` ↔ `POST /inventory/sync`
  - `GET /calendar/list` ↔ `POST /calendar/sync|merge`
  - `GET /inbox/list` ↔ inbound webhooks / message send
  - `GET /admin/kpis`
- [ ] Confirm rate limiting uses Redis when `REDIS_URL` is present

### P4 — Agent‑led tutorial + one‑button workflows
- [x] Add `/tutorial` page (driver.js, 5 quick steps) and `/agents` disclosure page
- [x] Ask VX plan endpoint (`/ai/workflow/plan`) returns steps → tool calls + tour anchors
- [x] UI “Run the 5 workflows” radial button: executes tools sequentially; pauses for approvals
  - CRM Organization: import candidates → import selected → dedupe → reconcile missing
  - Book‑Filling: start dormant (60+ days) cadence (approval‑aware)
  - Client Communication: schedule reminders (7d/3d/1d/2h)
  - Social (scaffold): queue 14‑day content (respect provider limits)
  - Inventory: sync + low‑stock alerts panel

### P5 — Webhooks & safety
- [ ] Enable signature verification for FB/IG/Shopify/Square/Acuity (adapters)
- [ ] Expose public HTTPS endpoints (staging/prod) and configure provider consoles
- [ ] Use `dead_letters` for retry/backoff; add reprocess admin task

### P6 — Observability & tests
- [ ] Expand `/metrics` and `/admin/kpis` to cover cache hits, webhook outcomes
- [ ] Playwright E2E: onboarding timing persistence; AskVX plan runner; curation swipe; approvals
- [x] Pytests: green locally (15 passed with TESTING=1)
- [x] Analytics events wired (pageviews, workflow actions, AskVX plan)

### Transcendent patterns (promote to shared utilities)
- Tool execution with approvals gating → single executor path (already via `/ai/tools/execute`)
- Cache wrapper with invalidation keys per endpoint
- Tenant‑scoped guards and idempotency keys for all sends
- Guide‑step registry (driver.js) reused across pages and Ask VX plan runner

### Ask VX — Guardian prompt (template)
> “Run UFIS Guardian Check. Return: gaps to production credibility, mitigations, 5 immediate actions (mapped to tools/pages), and a short diff plan for this checklist. Then propose a step‑by‑step plan to execute now with approvals.”
