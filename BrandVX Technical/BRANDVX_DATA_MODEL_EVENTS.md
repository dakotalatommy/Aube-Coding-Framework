\# BrandVX — Data Model & Event Taxonomy (Technical)

Purpose: A single source of truth for entities, events, properties, identity, and retention. Powers product analytics, AI context windows, and automations.

\#\# 0\) Identity & Keys  
\- \*\*tenant\_id\*\* (UUID, required)  
\- \*\*operator\_id\*\* (UUID) — human user account  
\- \*\*contact\_id\*\* (UUID) — lead/client person  
\- \*\*appointment\_id\*\*, \*\*message\_id\*\*, \*\*campaign\_id\*\*, \*\*inventory\_item\_id\*\*, \*\*invoice\_id\*\*  
\- \*\*external\_ids\*\*: \`{ hubspot\_id, square\_id, acuity\_id, shopify\_id }\`  
\- \*\*pii fields\*\*: \`email\`, \`phone\`, \`name\` → always encrypted at rest; masked in logs.

\#\# 1\) Core Entities (Tables / Collections)  
\- \*\*Tenant\*\*: plan, settings, compliance flags.  
\- \*\*Operator\*\*: role, permissions, locale.  
\- \*\*Contact\*\*: status (lead/client), consent flags, tags, sources.  
\- \*\*Appointment\*\*: start/end, service, staff, location, status.  
\- \*\*Message\*\*: channel (sms/email), direction, template\_id, state.  
\- \*\*Campaign\*\*: type (lead, reminder, nurture), variant, schedule.  
\- \*\*InventoryItem\*\*: sku, qty, thresholds.  
\- \*\*RevenueRecord\*\*: amount, currency, source (POS/invoice).  
\- \*\*AuditLog\*\*: actor, action, entity\_ref, diff, timestamp.

\#\# 2\) Event Catalog (CamelCase names, JSON payloads)

\#\#\# 2.1 Tenant & Operator  
\- \`TenantCreated\`  
\`\`\`json  
{ "tenant\_id":"...", "plan":"trial", "source":"signup", "ts":"..." }  
OperatorCreated

json  
Copy  
Edit  
{ "tenant\_id":"...", "operator\_id":"...", "role":"operator", "email\_hash":"...", "ts":"..." }  
2.2 Integrations  
IntegrationConnected — { "tenant\_id":"...","provider":"hubspot","scopes":\["contacts"\],"ts":"..." }

CrmSyncStart / CrmSyncComplete — counts, durations, failures.

CalendarConnected / CalendarSyncComplete

PosConnected / InventorySyncComplete

2.3 Contacts & Consent  
ContactImported — source file/hash, row\_count, success\_count, error\_count.

ConsentUpdated — { contact\_id, channel:"sms|email", consent:"granted|revoked", reason, ts }

2.4 Lead & Funnel  
LeadCreated — acquisition\_source, utm params, tags.

LeadQualified / LeadDisqualified — reasons taxonomy.

LeadConverted — → client.

2.5 Appointments  
AppointmentIngested — external\_ref, dedup\_key.

ReminderScheduled — { appointment\_id, schedule:\[{channel, ts}\] }

AppointmentStatusChanged — { from, to } (booked→completed, booked→cancelled)

2.6 Messaging  
MessageQueued — { message\_id, channel, template\_id, to\_hash, ts }

MessageSent — provider message\_ref, cost\_micros.

MessageDelivered / MessageFailed — failure\_code, retry\_count.

MessageFallbackEngaged — reason, fallback\_channel.

InboundMessageReceived — normalized body, intent: confirm|reschedule|stop|help|unknown.

SuppressionAdded — keyword STOP/HELP with evidence.

2.7 Campaigns & Cadences  
CadenceStarted — cadence\_id, branch.

CadenceStepCompleted — step\_id, result.

CadenceExited — reason: completed|converted|suppressed|timeout.

2.8 Inventory & Revenue  
InventoryAdjusted — delta, cause: sale|manual|low\_stock\_alert.

SaleRecorded — amount, pos\_ref, items\[\].

RevenueSnapshotComputed — window, totals.

2.9 Dashboards & Insights  
MetricsComputed — { time\_saved\_minutes, revenue\_uplift, usage\_index }

AmbassadorCandidateFlagged — rules matched.

2.10 Audit & Security  
LoginSucceeded / LoginFailed

RoleChanged

EntityExported

DataDeletionRequested / DataDeletionCompleted

3\) Properties & Schemas (selected)  
Message (canonical)  
json  
Copy  
Edit  
{  
  "message\_id":"uuid",  
  "tenant\_id":"uuid",  
  "channel":"sms|email",  
  "direction":"outbound|inbound",  
  "template\_id":"string|null",  
  "to\_hash":"sha256(email|phone)",  
  "body":"string(redacted\_in\_logs)",  
  "status":"queued|sent|delivered|failed|suppressed",  
  "metadata":{"provider":"twilio|sendgrid","price\_micros":1234},  
  "ts":"iso8601"  
}  
Appointment  
json  
Copy  
Edit  
{  
  "appointment\_id":"uuid",  
  "tenant\_id":"uuid",  
  "contact\_id":"uuid",  
  "service":"string",  
  "staff":"string|null",  
  "start\_ts":"iso8601",  
  "end\_ts":"iso8601",  
  "status":"booked|completed|cancelled|no\_show",  
  "source":"external|manual",  
  "external\_ref":"string|null"  
}  
4\) Event Governance  
Idempotency: dedup\_key on ingest events; drop duplicates.

PII: Never in event bodies beyond hashed identifiers; raw PII stays in entity store.

Retention: events 25 months; audits 7 years; configurable per-tenant legal needs.

Partitioning: by tenant\_id \+ hour bucket for warehouse writes.

5\) Analytics Marts (derived)  
funnel\_daily (visits→lead→booked→completed)

cadence\_performance (step CTR/reply/convert)

time\_saved\_rollup (modeled per action)

revenue\_uplift\_attribution (cadence/campaign model)

6\) AI Context Windows  
Summarizers read: last 90 days of Message\*, Cadence\*, Appointment\*, MetricsComputed.

Strict token budgets with priority tiers: recent \> high-signal \> aggregate.

yaml  
Copy  
Edit

\---

\# Final “Master Boot” prompt (drop‑in for Lovable / Cursor / Codex)

Paste this as the \*\*first message\*\* in a new session:

SYSTEM // BRANDVX MASTER BOOT (H→L)  
You are initializing a coding \+ product execution session for the BrandVX beauty automation platform. Load and internalize the following, in order:

\[1\] TECHNICAL BOOT (H-layer)

Github folder: “Github Instructions/BrandVX Technical/”

Required files:

BRANDVX\_TEMPORAL\_RUNTIME\_BOOT.md

BRANDVX\_TECHNICAL\_README.md (or latest)

BRANDVX\_ACCEPTANCE\_TESTS.md

BRANDVX\_DATA\_MODEL\_EVENTS.md

RCLP\_HL\_MAPPING\_GUIDE.md (if present)

SUPPLEMENTAL\_CONTEXT.md (if present)

\[2\] BRAND VOICE BOOT (L-layer)

Github folder: “Github Instructions/BrandVX Brand-Voice/”

Required files:

BRANDVX\_RUNTIME\_BOOT\_BRAND\_VOICE.md

BRANDVX\_BRAND\_VOICE\_README.md (or latest)

BRANDVX\_APP\_OVERVIEW\_BRAND.md

\[3\] REPO DOCS (Context Pack)

Github folder: “Github Repo Docs/”

Load titles only \+ vector summaries; full content on-demand:

User Experience.pdf

AGENT\_RUNTIME\_AND\_MODULARITY.md

CODE\_GUIDELINES.md

FEATURES\_TIME\_SAVER\_AND\_SHARING.md

The Unified Field Intelligence Scale (2).pdf

ACE INSTRUCTIONS (1).pdf

The Market Psychohistory Engine.pdf

Soft-Reality Theory.pdf

Project Overview & Simulation Entry Prompt.md

Quantum Leaps and Neural Evolution Define AI Training in 2025.pdf

(…plus any new docs in this folder)

RUNTIME RULES

Always apply \[H\] technical constraints before \[L\] tone. If conflicts, \[H\] wins.

Run a light 12-iteration UFIS scan only to surface risks/edges, then proceed to shipping tasks.

For every significant design/code artifact, emit: Acceptance mapping (which tests), Event impacts (which events), and Data privacy notes.

Prioritize building: onboarding flow, CRM/booking integrations, cadences engine, dashboards, safety/opt-out, audits.

TASK NOW

Confirm load succeeded; list any missing required files.

Generate a sprint plan (1 week) mapped to acceptance tests.

Scaffold the codebase (Python backend \+ orchestration, web UI) with stubs for integrations, cadences, dashboards, and event emitters per BRANDVX\_DATA\_MODEL\_EVENTS.md.

Produce a minimal end-to-end demo path: import contacts → start cadence → send test message (simulated) → see dashboard metrics update.

CONSTRAINTS

Deterministic seeds for tests.

No PII in logs; hash emails/phones.

Emit events for every significant action using the provided schemas.

yaml  
Copy  
Edit

\---

\# Quick system review & gaps

\*\*Strengths\*\*  
\- Clear H↔L separation with single boot order; explicit acceptance \+ event schemas; UX distilled; admin vs operator split defined; compliance pathways included.  
\- Temporal synthesis is scoped to \*assist\* planning, not block shipping (good).

