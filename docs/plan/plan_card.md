# Plan Card (H→L, UFIS‑backed)
version: v1
date: 
goal: Align to UX LAW with minimal deltas; no invariant violations.

## Modules & Interfaces
- H tables: appointments, messages
- Reminder scheduler (7d/3d/1d/2h); quiet-hours per tenant
- Provider layer: Twilio+SendGrid with strict signatures, SMS→email fallback
- Events ledger + marts: funnel_daily, time_saved_rollup
- Settings DTO: tone/services; Share milestones

## API Contracts
- POST /settings (persist tone/services)
- GET /cadences/queue, GET /buckets/distribution (existing)
- POST /notify-list/trigger-cancellation (existing)
- Webhooks: /webhooks/twilio, /webhooks/sendgrid (strict verify)

## Data Model
- appointments(id, tenant_id, contact_id, start_ts, end_ts, status, external_ref)
- messages(id, tenant_id, contact_id, channel, direction, template_id?, status, metadata, ts)

## Acceptance Tests (refs)
- See BRANDVX_ACCEPTANCE_TESTS.md §3, §4, §5

## Risks & Mitigations
- Deliverability: strict signatures, fallback
- Drift: invariants.md gating, double force-review


## Proposed Deltas @ TURN1_SCHEMA
{
  "turn": 1,
  "summary": "Add canonical H tables and ledger shells: lead_status, appointments, messages, events_ledger, and initial mart shells (funnel_daily, cadence_performance, time_saved_rollup, revenue_snapshot). Update SQLAlchemy models and create Alembic migrations only (no behavior changes).",
  "acceptance_refs": ["AT-3.1", "AT-3.2", "AT-4.x", "AT-5.2"],
  "files": [
    "src/backend/app/models.py",
    "alembic/versions/0006_core_state_tables.py",
    "alembic/versions/0007_metrics_marts_shells.py"
  ],
  "invariants_checked": [
    "Consent/STOP/HELP unaffected (no behavior change)",
    "One attempt per step not impacted",
    "Quiet-hours unaffected",
    "Idempotency untouched",
    "H owns canonical state — establishing required tables"
  ]
}

## Proposed Deltas @ TURN2_PROVIDERS
{
  "turn": 2,
  "summary": "Provider hardening: implement SendGrid Ed25519 signature verification; add optional SMS→email fallback on provider failure; maintain idempotency behavior.",
  "acceptance_refs": ["AT-3.3", "AT-5.1"],
  "files": [
    "src/backend/app/integrations/email_sendgrid.py",
    "src/backend/app/messaging.py",
    "requirements.txt"
  ],
  "invariants_checked": [
    "STOP/HELP and consent remain enforced",
    "Fallback only engages when consent and env allow",
    "No PII in logs; signatures strictly verified"
  ]
}

## Proposed Deltas @ TURN3_MESSAGING
{
  "turn": 3,
  "summary": "Introduce canonical POST /messages/send, consolidate simulate→send flow, and persist outbound messages to the messages ledger with status and metadata. Maintain idempotency key guard.",
  "acceptance_refs": ["AT-3.1", "AT-3.3"],
  "files": [
    "src/backend/app/main.py",
    "src/backend/app/messaging.py"
  ],
  "invariants_checked": [
    "Consent and rate limits enforced",
    "Quiet-hours unaffected (handled by scheduler)",
    "Idempotency key to prevent duplicates"
  ]
}

## Proposed Deltas @ TURN4_STATE_MACHINE
{
  "turn": 4,
  "summary": "Introduce lead-status endpoints and minimal state transitions on inbound intents (confirm/reschedule) to update bucket/tag and clear next_action_at.",
  "acceptance_refs": ["AT-3.1", "AT-5.1"],
  "files": [
    "src/backend/app/main.py"
  ],
  "invariants_checked": [
    "STOP/HELP flow remains authoritative and audited",
    "No extra attempts; transitions only update state",
    "Tenant scoping enforced"
  ]
}

## Proposed Deltas @ TURN5_REMINDERS
{
  "turn": 5,
  "summary": "Add appointments create endpoint and reminder scheduler (7d/3d/1d/2h) with quiet-hours deferral; idempotent sends per appointment+trigger.",
  "acceptance_refs": ["AT-3.2"],
  "files": [
    "src/backend/app/scheduler.py",
    "src/backend/app/main.py"
  ],
  "invariants_checked": [
    "Quiet-hours respected",
    "One attempt per step/trigger",
    "Consent enforced via send_message"
  ]
}

## Proposed Deltas @ TURN6_WEBHOOKS
{
  "turn": 6,
  "summary": "Add Acuity/Square booking webhooks with HMAC verification and idempotent appointment ingest (upsert by external_ref); schedule reminders after ingest.",
  "acceptance_refs": ["AT-2.2"],
  "files": [
    "src/backend/app/integrations/booking_acuity.py",
    "src/backend/app/integrations/booking_square.py",
    "src/backend/app/main.py",
    "src/backend/app/scheduler.py"
  ],
  "invariants_checked": [
    "Webhook verification required (env-based secrets)",
    "Idempotent ingest by external_ref",
    "Quiet-hours respected via scheduler"
  ]
}

## Proposed Deltas @ TURN7_MARTS
{
  "turn": 7,
  "summary": "Compute marts (funnel_daily, cadence_performance, time_saved_rollup) from events_ledger; add GET /funnel/daily real data and extend /metrics.",
  "acceptance_refs": ["AT-4.1"],
  "files": [
    "src/backend/app/main.py",
    "src/backend/app/kpi.py",
    "src/backend/app/events.py"
  ],
  "invariants_checked": [
    "No PII in marts (hashes only)",
    "Tenant partitioning enforced"
  ]
}

## Proposed Deltas @ TURN8_MART_POPULATION
{
  "turn": 8,
  "summary": "Add mart recomputation jobs and admin endpoint: recompute funnel_daily and time_saved_rollup from events/metrics; expose POST /marts/recompute (admin).",
  "acceptance_refs": ["AT-4.1"],
  "files": [
    "src/backend/app/marts.py",
    "src/backend/app/main.py"
  ],
  "invariants_checked": [
    "No PII in marts (hashes only)",
    "Tenant partitioning enforced"
  ]
}

## Proposed Deltas @ TURN9_DASHBOARD_METRICS
{
  "turn": 9,
  "summary": "Extend /metrics and admin KPIs to include revenue_uplift and referrals_30d; add aggregation helpers using revenue_snapshot and events_ledger.",
  "acceptance_refs": ["AT-4.1"],
  "files": [
    "src/backend/app/kpi.py",
    "src/backend/app/main.py"
  ],
  "invariants_checked": [
    "No PII in metrics",
    "Tenant scoping enforced"
  ]
}

## Proposed Deltas @ TURN10_GOLDEN_EVALS
{
  "turn": 10,
  "summary": "Add golden prompt files (registry) and extend gate to verify presence + safety keywords (consent, STOP/HELP, Soonest/Anytime, fallback tone).",
  "acceptance_refs": ["AT-6.1"],
  "files": [
    "docs/prompts/BVX_onboard_greeter_v1.md",
    "docs/prompts/BVX_lead_nurture_v1.md",
    "docs/prompts/BVX_fallback_tone_v1.md",
    "scripts/self_organize_gate.py"
  ],
  "invariants_checked": [
    "H-layer constraints appear in prompts",
    "Consent and safety language present"
  ]
}

## Proposed Deltas @ TURN11_ONBOARDING
{
  "turn": 11,
  "summary": "Add settings endpoints (GET/POST) for tone/services/preferences and onboarding completion to surface share prompt.",
  "acceptance_refs": ["AT-1.1", "AT-1.3"],
  "files": [
    "src/backend/app/main.py"
  ],
  "invariants_checked": [
    "No PII in settings",
    "Tenant scoping enforced"
  ]
}

## Proposed Deltas @ TURN12_ONBOARDING_COMPLETE
{
  "turn": 12,
  "summary": "Add POST /onboarding/complete to mark onboarding done and surface a default share prompt (share_onboarding).",
  "acceptance_refs": ["AT-1.1"],
  "files": [
    "src/backend/app/main.py"
  ],
  "invariants_checked": [
    "Tenant scoping",
    "No PII"
  ]
}

## Proposed Deltas @ TURN13_OPERATOR_UI
{
  "turn": 13,
  "summary": "Wire operator dashboard UI (cards, queue, funnel) and approvals/integrations pages to existing endpoints. Maintain Lovable visual system.",
  "acceptance_refs": ["AT-4.1", "AT-1.2"],
  "files": [
    "src/web/* (assets)",
    "docs/plan/plan_card.md"
  ],
  "invariants_checked": [
    "No secrets in client",
    "Calls only read/allowed endpoints"
  ]
}

## Proposed Deltas @ TURN14_LAUNCH
{
  "turn": 14,
  "summary": "Add nav shell for UI pages, .env.example, load check script, and runbook with SLOs/canary. No backend behavior changes.",
  "acceptance_refs": ["AT-7.1"],
  "files": [
    "src/web/nav.html",
    ".env.example",
    "scripts/load_check.py",
    "docs/RUNBOOK.md"
  ],
  "invariants_checked": [
    "No secrets in repo",
    "Gate remains green"
  ]
}


## Proposed Deltas @ 2025-08-16T04:30:00Z
{
  "summary": "Scaffold OAuth routes (login/callback) for Google, Square, Acuity, HubSpot, Facebook, Instagram; add POST /onboarding/analyze; wire onboarding UI with connect buttons and analysis feedback.",
  "acceptance_refs": ["AT-1.1", "AT-2.2"],
  "files": [
    "src/backend/app/main.py",
    "apps/operator-ui/src/pages/Onboarding.tsx",
    "apps/operator-ui/src/App.tsx",
    "apps/operator-ui/src/components/ui/Toast.tsx",
    "apps/operator-ui/src/hooks/useLenis.ts",
    "apps/operator-ui/src/components/Nav.tsx",
    "apps/operator-ui/src/pages/Dashboard.tsx",
    "apps/operator-ui/src/components/CommandPalette.tsx"
  ],
  "invariants_checked": [
    "Consent-first UX (no auto-posts; explicit user actions)",
    "No service role keys in browser; env placeholders only",
    "Accessibility: tooltips, skip links, keyboard palette"
  ],
  "gaps": [
    "Exchange codes for tokens and persist per-tenant creds (server)",
    "Provider-specific scopes confirmation",
    "Deep analysis implementation beyond env presence"
  ]
}

## Proposed Deltas @ 2025-08-15T05:23:24Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T05:49:08Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T05:53:45Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T05:56:04Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T06:04:29Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T06:19:11Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T06:30:30Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T06:44:11Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T07:00:14Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T07:05:33Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T07:10:32Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T07:23:19Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T07:33:00Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T07:40:22Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T07:46:08Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T08:18:20Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T08:22:20Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T10:54:26Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T11:11:03Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T11:28:33Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T19:26:16Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T20:01:30Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-15T20:04:57Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-16T03:02:46Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-16T03:12:17Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-16T03:21:16Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-16T03:31:54Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-16T04:01:53Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-16T04:21:48Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}


## Proposed Deltas @ 2025-08-20T02:29:59Z
{
  "summary": "Add canonical H tables (appointments, messages), strict webhook verify, SMS\u2192email fallback, reminder scheduler, events ledger+marts.",
  "acceptance_refs": [
    "AT 3.x, 4.x, 5.x in BRANDVX_ACCEPTANCE_TESTS.md"
  ],
  "gaps": []
}
