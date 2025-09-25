## AI Contexts and Tools – Launch Guide

Purpose: unify how GPT‑5 and tools operate across BrandVX, align outputs with UX, set demo vs. signed‑in behavior, and give developers a single reference for extending contexts and tools safely.

### Scope
- Ask VX chat endpoints and prompt assembly
- Context modes and per‑mode tool allowlists
- Tool registry, SAFE_TOOLS, approvals policy
- Demo workspace gating vs. signed‑in workspace behavior
- PII policy (client names) and data‑grounded answers
- Testing, observability, and cost controls

---

## Architecture Overview

### Models and client
- Default model: `gpt-5` (Responses API). Fallbacks: `gpt-5-mini`.
- Responses API used for GPT‑5; Chat Completions only for non‑GPT‑5 fallbacks.
- Vision/Image helpers available (Responses for vision analysis; Images API for generations).
- Embeddings: `text-embedding-3-small` by default.

Key files:
- `src/backend/app/ai.py` – OpenAI client, Responses/Chat logic, retries, extraction.
- `src/backend/app/brand_prompts.py` – `BRAND_SYSTEM`, `chat_system_prompt` composer.
- `src/backend/app/contexts_detector.py` – `detect_mode(user_text)` heuristics.
- `src/backend/app/contexts.py` – Contexts manifest and per‑mode allowlist.
- `src/backend/app/tools.py` – Tool functions, registry (`REGISTRY`), `TOOL_META`, schema.
- `src/backend/app/main.py` – API routes including AI chat, tools, contexts.

### Primary AI endpoints
- POST `/ai/chat` – main chat; builds system prompt with brand profile, policy, benefits, integrations, rules, scaffolds; injects capabilities/tools; auto‑detects mode; adds lightweight data context for specific analytics.
- POST `/ai/chat/raw` – simpler brand‑voice chat; still RBAC; fewer guards (used by Ask VX surface).
- GET `/ai/contexts/schema` – context modes with preambles and allowlisted tools.
- GET `/ai/tools/schema` – machine schema of tools (`TOOL_META`).
- GET `/ai/tools/schema_human` – human‑friendly subset (labels/categories).
- POST `/ai/tools/execute` – execute a named tool; SAFE_TOOLS vs approvals; throttles.
- POST `/ai/tools/qa` – dry‑run style execution for previews/QA.
- Other: `/ai/embed`, `/ai/vision`, `/ai/image`, `/ai/search`.

### Data flow & guardrails
- Read‑only answers: can be produced directly when lightweight context is injected (e.g., top LTV list) or via `db.query.*` tools.
- Writes and side‑effects: must go through tools; approvals required for risky items.
- SAFE_TOOLS allowlist: executes without approvals (still rate‑limited & RBAC’d).

### Cost & rate limits
- Per‑tenant and global token/US$ caps enforced in `/ai/chat`.
- Rate limiting by tenant per minute.
- Telemetry and cost tracking stored via cache and events.

---

## System Prompts and Modes

### BRAND_SYSTEM (baseline)
Principles applied to all GPT‑5 interactions:
- Tone: clear, concise, warm‑confident, brand‑aligned.
- Consent & privacy: only store/modify via explicit tools; never imply hidden access.
- Tool usage: suggest actions; wait for confirmation; no chain‑of‑thought in outputs.

Launch clarifications (policy updates):
- Signed‑in users: it’s OK to display client names and identifiers that come from their workspace (e.g., imported from Square). Do not over‑mask.
- Demo users: never show real PII; use mock names and sample data only.
- Natural‑language tool suggestions (NLTS): never expose internal tool IDs or registry names to users. Use friendly, user‑facing action labels.

### `chat_system_prompt` fields
- Capabilities: features + tools available (mode‑filtered when applicable).
- Integrations: Calendar/Booking/CRM/Inventory/Email/SMS/Social, with state hints.
- Benefits: short outcomes bullets.
- Pricing Policy: env‑driven text; avoid numbers unless provided.
- Guardrails: recommend‑only, quiet hours, STOP/HELP, approvals.
- Scaffolds: structured answer patterns (answer‑first; concise; next step).
- Brand profile: injected from tenant settings.

### Mode detection and preambles
- Detector: `detect_mode(user_text)` heuristics (support, messaging, scheduler, analysis, train, todo).
- Preambles and per‑mode allowlists (from `contexts.py`):
  - support – Answer‑first (2–4 sentences), point to exact UI locations. Tools: `link.hubspot.signup`, `oauth.hubspot.connect`, `crm.hubspot.import`, `db.query.named`, `db.query.sql`, `report.generate.csv`.
  - analysis – Use read‑only data; return lists/single‑line facts; no assumptions. Tools: `db.query.named`, `db.query.sql`, `report.generate.csv`, `contacts.list.top_ltv`, `campaigns.dormant.preview`.
  - messaging – Consent‑first drafting; short actionable copy. Tools: `draft_message`, `messages.send`, `appointments.schedule_reminders`, `campaigns.dormant.preview`, `campaigns.dormant.start`, `propose_next_cadence_step`, `safety_check`, `pii.audit`.
  - scheduler – Offer concrete times; avoid overbooking; reconcile calendars. Tools: `calendar.sync`, `calendar.merge`, `calendar.reschedule`, `calendar.cancel`, `oauth.refresh`.
  - train – Refine tone/brand profile; save‑ready edits. Tools: `safety_check`, `pii.audit`, `memories.remember`, `report.generate.csv`.
  - todo – Create concise, actionable tasks. Tools: `todo.enqueue`, `report.generate.csv`.

### Dynamic capability injection
`/ai/chat` injects a capabilities JSON (features + tools filtered by chosen mode). Use this for truthful model self‑awareness; do not let the model advertise non‑existent abilities.

---

## Demo vs Signed‑In Behavior

### Demo workspace (landing “try the demo”)
- UI surfaces are visible; tool execution is disabled.
- Chat replies are simulated or read‑only (no state changes; no `/ai/tools/execute`).
- NL suggestions allowed, but must not include internal tool IDs; use friendly labels (e.g., “Run Revenue (Last 90 days) report”).
- PII: only mock names and sample data.

Implementation notes:
- Frontend already reads `?demo=1` and hides/disables actions in many places. Standardize a hard “no tools” guard: never call `/ai/tools/execute` when `demo=1` or on demo routes.
- Optional server safety: if a request is associated with demo tenancy/context, return `{ status: 'forbidden', reason: 'demo_mode' }` from tools routes.

### Signed‑in workspace
- Full tool access (subject to RBAC, SAFE_TOOLS, and approvals).
- PII allowed per tenant’s data: show client names and identifiers.
- NL suggestions follow user‑facing action labels and require confirmation before execution.

---

## Tooling Registry and Policy

### Where tools live
- `src/backend/app/tools.py` implements tool functions and the execution dispatcher.
- `TOOL_META` provides machine schema: public flag, description, and params. Exposed via `/ai/tools/schema`.
- `/ai/tools/schema_human` returns a curated set with friendly labels/categories for UI.

### Execution path
1) Model proposes an action (NL suggestion) → UI renders user‑facing action name and parameters for confirmation.
2) On approval, frontend calls `POST /ai/tools/execute` with `{ name, params }`.
3) Server applies throttles, SAFE_TOOLS, approvals policy, and RBAC, then executes.

### SAFE_TOOLS and approvals
- SAFE_TOOLS run without approvals (still RBAC’d): includes read/reporting tools and select safe actions like `image.edit`, `vision.analyze.gpt5`, `brand.vision.analyze`.
- Risky tools (anything not in SAFE_TOOLS) route to approvals when the global pause is enabled, or when marked gated.

### Natural‑language tool suggestions (NLTS)
- Do not reveal internal tool IDs (e.g., `db.query.named`, `campaigns.dormant.start`).
- Always present a user‑facing action label and the reason, e.g.:
  - “Run Revenue (Last 90 days) report to calculate your last 3 months’ revenue.”
  - “Draft a follow‑up message and queue reminders.”
- In demo: only describe the action; never execute.

### PII policy
- Signed‑in: it’s acceptable to surface client names and identifiers present in the tenant’s workspace. Do not mask legitimate UX.
- Demo: never show real PII; use mock names.

---

## Contexts and Tool Inventory (at a glance)

### Context modes (from `contexts.py`)
- support – tools: `link.hubspot.signup`, `oauth.hubspot.connect`, `crm.hubspot.import`, `db.query.named`, `db.query.sql`, `report.generate.csv`.
- analysis – tools: `db.query.named`, `db.query.sql`, `report.generate.csv`, `contacts.list.top_ltv`, `campaigns.dormant.preview`.
- messaging – tools: `draft_message`, `messages.send`, `appointments.schedule_reminders`, `campaigns.dormant.preview`, `campaigns.dormant.start`, `propose_next_cadence_step`, `safety_check`, `pii.audit`.
- scheduler – tools: `calendar.sync`, `calendar.merge`, `calendar.reschedule`, `calendar.cancel`, `oauth.refresh`.
- train – tools: `safety_check`, `pii.audit`, `memories.remember`, `report.generate.csv`.
- todo – tools: `todo.enqueue`, `report.generate.csv`.

### Representative tool groups (see `/ai/tools/schema` for full list)
- Messaging/CRM: `draft_message`, `messages.send`, `contacts.dedupe`, `contacts.list.top_ltv`, `contacts.import.square`.
- Campaigns: `campaigns.dormant.preview`, `campaigns.dormant.start` (gated).
- Scheduling: `appointments.schedule_reminders`, `calendar.sync|merge|reschedule|cancel`.
- Data: `db.query.sql` (read‑only), `db.query.named`, `report.generate.csv`.
- Safety/Consent: `safety_check`, `pii.audit`, `propose_next_cadence_step`, `stop_cadence`.
- Vision/Image/Brand: `vision.inspect`, `vision.analyze.gpt5`, `image.edit`, `brand.vision.analyze`, `social.fetch_profile`, `social.scrape_posts`.
- Infra/Connectors: `oauth.refresh`, `connectors.cleanup|normalize`, `square.backfill`.
- Memory/TODO: `memories.remember`, `todo.enqueue`.

Tip: for user‑facing labels, prefer `/ai/tools/schema_human` and expand coverage over time.

---

## Observability and Cost
- Events: `AIChatResponded`, `AIToolExecuted` (with status), plus standard metrics/events for connectors.
- `/ai/costs` (if enabled) and token counters in `/ai/chat` enforce caps.
- `/admin/tools/telemetry` provides a simple per‑tool activity list.

---

## Testing Matrix (Smoke)

Per mode (support, analysis, messaging, scheduler, train, todo), cover:
1) Direct Q&A (answer‑first; concise; correct).
2) NL suggestion without internal IDs; user‑facing label and reason.
3) Approvals: suggestion requires approval; denied and accepted paths.
4) SAFE_TOOLS: executes without approvals.
5) Demo: no execution; mock data; descriptive only.
6) PII: signed‑in names visible; demo masked.

### Sample cURL (discovery and sanity)
```bash
# Tools (machine + human)
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/ai/tools/schema" | jq .
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/ai/tools/schema_human" | jq .

# Contexts manifest
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/ai/contexts/schema" | jq .

# Chat: analysis ask (signed‑in)
curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tenant_id":"'$TENANT'","messages":[{"role":"user","content":"List top 3 clients by lifetime value"}],"mode":"analysis"}' \
  "$BASE/ai/chat" | jq .

# Chat Raw (brand-voice)
curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"tenant_id":"'$TENANT'","messages":[{"role":"user","content":"Draft a friendly SMS follow‑up"}]}' \
  "$BASE/ai/chat/raw" | jq .
```

---

## How to Extend
- Add a tool: implement function in `tools.py`, update `REGISTRY` and `TOOL_META`, decide SAFE_TOOLS/approvals, add human label in `/ai/tools/schema_human`, and include in context allowlists where appropriate.
- Add/adjust a mode: update `contexts.py` preamble and tool allowlist; optionally tweak `detect_mode` heuristics; confirm capability injection in `/ai/chat`.
- Update voice/policy: refine `BRAND_SYSTEM` and `chat_system_prompt` scaffolds.

---

## Troubleshooting
- Model says it can’t access data: ensure brand profile and capabilities are injected; verify read‑only paths.
- Tool names visible to users: update NLTS scaffolds, UI action labels, and avoid surfacing internal IDs in prompts.
- PII names missing for signed‑in users: confirm policy text and that demo guards aren’t active; verify data exists.
- Approvals stuck: check SAFE_TOOLS list and global approvals pause flag; inspect `AIToolExecuted` events.
- Rate/cost limits: adjust caps via env; confirm counters and logs.

---

## File References
- Prompts: `src/backend/app/brand_prompts.py`
- Detector: `src/backend/app/contexts_detector.py`
- Contexts: `src/backend/app/contexts.py`
- Tools/Schema: `src/backend/app/tools.py`
- AI routes: `src/backend/app/main.py`
- UI tool calls: see usages of `/ai/chat*` and `/ai/tools/execute` in `apps/operator-ui/**/*.{ts,tsx}`

---

## Launch To‑Do (context engineering)
- Demo gating: hard “no tools” execution in demo; descriptive NL suggestions only.
- NL tool suggestions: never surface internal IDs; use user‑facing labels.
- PII rules: allow client names in signed‑in mode; mock only in demo.
- Tighten per‑mode preambles and allowlists; align to UX.
- Curate SAFE_TOOLS and approvals policy for launch.
- Audit `TOOL_META` descriptions and params for clarity.
- Smoke tests across modes (answers, suggestions, approvals, PII, demo).
- Observability: verify costs/limits and telemetry dashboards.

