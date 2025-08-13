\# BrandVX — End‑to‑End Acceptance Tests (Technical)

Scope: Verifies the BrandVX beauty automation platform meets functional, data, AI-runtime, and UX requirements across operator (user) and admin roles.    
Sources informing scope: BrandVX UX brief, runtime boot docs (technical \+ brand‑voice), ACE agent instructions, UFIS temporal synthesis notes, AUBE roadmap.

\#\# 0\) Test Principles  
\- \*\*Given/When/Then\*\* style, deterministic inputs, seed data where applicable.  
\- \*\*Cold‑start safe:\*\* Tests must pass on a fresh tenant with only required integrations connected.  
\- \*\*Observability:\*\* Every test emits events defined in \`BRANDVX\_DATA\_MODEL\_EVENTS.md\`.  
\- \*\*Privacy:\*\* No PII leaves the workspace; opt‑out honored; audit trails on.

\---

\#\# 1\) Onboarding & Identity

\#\#\# 1.1 Account Creation  
\*\*Given\*\* a new operator    
\*\*When\*\* they sign up with email \+ password and verify email    
\*\*Then\*\* tenant is created, Operator profile exists, default roles seeded (Operator, Admin), and \`tenant\_created\` \+ \`operator\_created\` events are emitted.

\#\#\# 1.2 Role Separation (Operator vs Admin)  
\*\*Given\*\* both Operator and Admin logins exist    
\*\*When\*\* each logs in    
\*\*Then\*\* Operator sees operator dashboard; Admin sees admin dashboard with global metrics, tenant list, impersonation guardrails, audit viewer.

\#\#\# 1.3 Consent & Messaging Compliance  
\*\*Given\*\* a tenant without prior consents    
\*\*When\*\* operator imports contacts and flags marketing consent    
\*\*Then\*\* contacts without consent are excluded from campaigns; “STOP/HELP” handling is active; \`consent\_updated\` events recorded.

\---

\#\# 2\) Integrations & Data Sync

\#\#\# 2.1 HubSpot (CRM)  
\*\*Given\*\* HubSpot OAuth success    
\*\*When\*\* initial sync runs    
\*\*Then\*\* leads/contacts sync bidirectionally (deduped by email/phone), lifecycle stages map, and \`integration\_connected\`, \`crm\_sync\_start/complete\` fire.

\#\#\# 2.2 Booking (Square/Acuity)  
\*\*Given\*\* calendar connected    
\*\*When\*\* an appointment is created externally    
\*\*Then\*\* BrandVX ingests it within SLA (\<2 min), dedupes, and schedules reminders per template; \`appointment\_ingested\` \+ reminder schedule events fire.

\#\#\# 2.3 POS/Inventory (Shopify/Square POS)  
\*\*Given\*\* POS connected    
\*\*When\*\* inventory changes or sales occur    
\*\*Then\*\* inventory reflects in-app; low‑stock alerts can trigger campaigns (opt-in); revenue figures aggregate to dashboards.

\---

\#\# 3\) Cadences & Messaging

\#\#\# 3.1 Lead Handling (Warm/Cold)  
\*\*Given\*\* a new lead enters CRM with phone \+ consent    
\*\*When\*\* lead is created    
\*\*Then\*\* appropriate cadence (warm/cold) starts; if no reply → branch to “Never Answered” with polite exit; all steps logged.

\#\#\# 3.2 Booking Reminders  
\*\*Given\*\* an upcoming appointment    
\*\*When\*\* reminder windows hit (e.g., 48h/24h/2h)    
\*\*Then\*\* SMS/email sends with correct merge fields; replies (confirm/reschedule/stop) are parsed and state transitions captured.

\#\#\# 3.3 Failovers & Rate Limits  
\*\*Given\*\* SMS failure (carrier block)    
\*\*When\*\* sending fails    
\*\*Then\*\* email fallback engages; retries back‑off; no exceeding rate limits; \`message\_failed\`, \`message\_fallback\_engaged\` emit.

\---

\#\# 4\) Dashboards & KPIs

\#\#\# 4.1 Operator Dashboard  
\*\*Given\*\* active usage for 7 days    
\*\*When\*\* operator opens dashboard    
\*\*Then\*\* shows Time Saved, Revenue Uplift, Usage Index, Referrals, Funnel (impressions→retained), and “Ambassador Candidates”.

\#\#\# 4.2 Admin Dashboard  
\*\*Given\*\* ≥ 5 tenants live    
\*\*When\*\* admin opens admin dashboard    
\*\*Then\*\* sees tenant health, cohort retention, cadences health, and audit anomalies.

\---

\#\# 5\) Safety, Privacy, Audit

\#\#\# 5.1 Opt‑Out & Compliance  
\*\*Given\*\* contact replies “STOP”    
\*\*When\*\* message is ingested    
\*\*Then\*\* suppression is immediate across all channels; evidence is auditable.

\#\#\# 5.2 Audit Trails  
\*\*Given\*\* admin opens audit view    
\*\*When\*\* filtering by entity (message/lead/appointment)    
\*\*Then\*\* all mutations show who/when/what with payload diffs, exportable.

\---

\#\# 6\) AI Runtime Boot & Temporal Synthesis

\#\#\# 6.1 Technical Boot Then Brand Layer  
\*\*Given\*\* a new AI session    
\*\*When\*\* system loads technical boot doc then brand‑voice doc    
\*\*Then\*\* responses conform to technical constraints and brand tone.

\#\#\# 6.2 UFIS‑Mapped Simulation (12×10‑year)  
\*\*Given\*\* “Scenario Planning: Retention Increase 20%”    
\*\*When\*\* the runtime triggers 12-iteration simulation (per UFIS dimensions)    
\*\*Then\*\* it outputs a plan per dimension \+ a synthesis step “outside time”, with rationale, risks, and KPIs.

\---

\#\# 7\) Performance & Reliability

\#\#\# 7.1 Latency  
\- \*\*Cold prompt\*\* P95 \< 6s; \*\*warm\*\* P95 \< 2.5s.  
\- \*\*Webhook ingestion\*\* P95 \< 2 min for bookings.

\#\#\# 7.2 Idempotency & Retries  
\- Duplicate webhooks do not create dup records.  
\- Network flaps recover without operator action.

\---

\#\# 8\) UX Flows (Operator)

\#\#\# 8.1 Day‑1 Checklist  
\*\*When\*\* operator completes guided checklist    
\*\*Then\*\* app verifies integrations, test send, sample cadence preview, legal disclosures acknowledged.

\#\#\# 8.2 Edge Cases  
\- Double‑booking conflict resolution screen.  
\- “Long‑silence archive” prompts with recover option.

\---

\#\# 9\) Reporting, Export, Deletion

\#\#\# 9.1 Data Portability  
\*\*When\*\* operator exports    
\*\*Then\*\* CSV/JSON for contacts, messages, appointments, inventory, with documented schemas.

\#\#\# 9.2 Right to Erasure  
\*\*When\*\* deletion is requested    
\*\*Then\*\* PII is erased within SLA, tombstones retained for audits.

\---

\#\# 10\) Go‑Live Gate  
All critical tests above must pass in CI and staging with green audits and non‑flaky runs.

