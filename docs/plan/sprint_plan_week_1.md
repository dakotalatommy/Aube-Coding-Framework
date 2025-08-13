# Sprint Plan — Week 1 (Mapped to ATs)

Goals
- MVP demo path: import contacts → start cadence → simulate one message → metrics update
- Establish RBAC skeleton, event emitters, and integration stubs

Backlog (ordered)
1) Backend scaffold (FastAPI) with endpoints and events [AT‑006, AT‑005]
2) Contacts import (simulated) and cadence start [AT‑003, AT‑003.1]
3) Message simulate + metrics rollup [AT‑003.3, AT‑006]
4) Minimal web UI stub for demo path [AT‑006]
5) RBAC guard middleware placeholder [AT‑001, AT‑002]
6) Integration adapters (stubs): HubSpot, Acuity [AT‑003, AT‑004]
7) Audit/consent event hooks [AT‑005]

Day plan
- Day 1: Repo scaffolds, FastAPI app, health, events; docs updated
- Day 2: Import contacts endpoint, cadence start; trace logging
- Day 3: Message simulate, metrics; BOOT OK validation
- Day 4: Web UI stub; wire to endpoints
- Day 5: RBAC placeholder, integration stubs, polish and readme

Acceptance mapping
- AT‑001 Auth & RBAC: middleware placeholder + routes separation
- AT‑002 Tenant Isolation: scope hooks added (no-op until auth)
- AT‑003 CRM Sync/Import: import path + event emission (simulated)
- AT‑004 Booking Ingest: adapter interface added (stub)
- AT‑005 Consent/Audit: event hooks and redaction policy
- AT‑006 KPIs/Dashboard: metrics endpoint + rollup

Risks
- No PDF parsing in this environment → summarized by title only; see `synthesis/risks.md`


