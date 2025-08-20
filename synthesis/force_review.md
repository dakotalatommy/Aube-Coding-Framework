# Force Review Ledger
Initialized: 2025-08-15T00:00:00Z

Each plan delta must include two reviews:

## Review A
status: approved
notes: TURN1_SCHEMA approved. Proceeding to TURN2_PROVIDERS for signature verification and safe fallback.

## Review B
status: approved
notes: TURN1_SCHEMA approved. TURN2_PROVIDERS scope is isolated to provider verification and fallback; invariants preserved.

## Review A (TURN3_MESSAGING)
status: approved
notes: Introduce POST /messages/send and persist messages; enforce consent, rate limit, idempotency. No scheduling changes yet.

## Review B (TURN3_MESSAGING)
status: approved
notes: Scope is minimal and coherent; simulate path will reuse the canonical send to consolidate behavior.

## Review A (TURN4_STATE_MACHINE)
status: approved
notes: Add lead-status state transitions for confirm/reschedule, scoped to tenant; STOP remains authoritative.

## Review B (TURN4_STATE_MACHINE)
status: approved
notes: Only state updates; no extra sends or cadence triggers in this turn.

## Review A (TURN5_REMINDERS)
status: approved
notes: Implement reminder scheduler with quiet-hours deferral and idempotency per appointment trigger.

## Review B (TURN5_REMINDERS)
status: approved
notes: Scope constrained to scheduling and safe deferral; consent and rate limits enforced by send path.

## Review A (TURN6_WEBHOOKS)
status: approved
notes: Add booking webhooks (Acuity/Square) with verification and idempotent ingest by external_ref; then schedule reminders.

## Review B (TURN6_WEBHOOKS)
status: approved
notes: Minimal blast radius; reuse existing scheduler to compute triggers; tenant scoping enforced.

## Review A (TURN7_MARTS)
status: approved
notes: Derive marts from events_ledger; ensure no PII; enforce tenant partitioning; expose endpoints.

## Review B (TURN7_MARTS)
status: approved
notes: Metrics are read-only views; safe to add; performance can be tuned later.

## Review A (TURN8_MART_POPULATION)
status: approved
notes: Add recomputation jobs and admin endpoint; read-only operations aggregating events.

## Review B (TURN8_MART_POPULATION)
status: approved
notes: No risk to invariants; run guarded to avoid heavy loads.

## Review A (TURN9_DASHBOARD_METRICS)
status: approved
notes: Extend KPIs and /metrics using existing marts; ensure no PII.

## Review B (TURN9_DASHBOARD_METRICS)
status: approved
notes: Safe read-only changes scoped to H-layer KPIs.

## Review A (TURN10_GOLDEN_EVALS)
status: approved
notes: Add golden prompts and gate checks for consent/STOP/HELP/Soonest-Anytime/fallback tone.

## Review B (TURN10_GOLDEN_EVALS)
status: approved
notes: Gate-level static checks only; model evaluation stays deterministic by keywords.

## Review A (TURN11_ONBOARDING)
status: approved
notes: Add settings GET/POST for tone/services/preferences; onboarding completion surfaces share prompt.

## Review B (TURN11_ONBOARDING)
status: approved
notes: Tenant-scoped settings only; no PII.

## Review A (TURN12_ONBOARDING_COMPLETE)
status: approved
notes: Mark onboarding done and surface share_onboarding prompt; read-only change for state.

## Review B (TURN12_ONBOARDING_COMPLETE)
status: approved
notes: Constrained to settings/share; no PII; tenant-scoped.
