\# Integration\_Specs\_CRM\_and\_Booking.md  
\*\*Layer:\*\* H (Technical Core)    
\*\*Purpose:\*\* Canonical specs for CRM and Booking integrations: data mapping, APIs, webhooks, idempotency, rate limits, error handling, and privacy.    
\*\*Scope (MVP):\*\* HubSpot (primary CRM), Acuity (primary booking). Optional adapters: Salesforce, Pipedrive, Square, Vagaro.

\---

\#\# 0\) Principles  
\- \*\*Idempotency first:\*\* all writes keyed; retries safe.  
\- \*\*Tenant isolation:\*\* every call & record scoped to \`tenant\_id\`.  
\- \*\*Least privilege:\*\* minimum scopes; no blanket tokens.  
\- \*\*Privacy & consent:\*\* redact PII in logs; audit \+ consent events emitted.  
\- \*\*Observability:\*\* metrics for calls, retries, failures; correlation IDs end-to-end.

\---

\#\# 1\) CRM — HubSpot (Primary)

\#\#\# 1.1 Data Model Mapping  
| Platform Entity | CRM Object     | Key Fields (→)                                   | Notes |  
|---|---|---|---|  
| \`Client\`        | Contact        | → \`email\`, \`phone\`, \`firstname\`, \`lastname\`      | Link via \`external\_id\` (HubSpot VID/ID) |  
| \`Client\`        | Company (opt)  | → \`company\`, \`domain\`                            | Optional for B2B |  
| Deals (future)  | Deal           | → \`amount\`, \`stage\`, \`pipeline\`                  | Not MVP, reserve fields |

\*\*Linkage fields (platform):\*\*  
\- \`CRMRecord\`: \`system='hubspot'\`, \`type='contact|company|deal'\`, \`external\_id\`, \`payload\`, \`synced\_at\`.

\#\#\# 1.2 API Contracts (High Level)  
\- \*\*Outbound (Platform → HubSpot)\*\*    
  \`POST /integrations/crm/hubspot/upsert\`    
  Body: \`{ tenant\_id, type: "contact|company|deal", attributes: {...}, idempotency\_key, correlation\_id }\`    
  Returns: \`{ external\_id, status }\`

\- \*\*Inbound (HubSpot → Platform Webhook)\*\*    
  \`POST /webhooks/crm/hubspot\`    
  Body: HubSpot change payload \+ headers    
  Action: enqueue sync job → upsert \`CRMRecord\` → emit \`crm.synced\` event.

\#\#\# 1.3 Idempotency & Dedup  
\- Key: \`sha256(tenant\_id \+ system \+ type \+ external\_id|natural\_key)\`    
\- Upserts must be \*\*PUT-like\*\* (create-or-update).    
\- Duplicate payloads → single persistent state; respond \`200 {status:'noop'}\` if nothing changed.

\#\#\# 1.4 Rate Limits & Backoff  
\- Respect HubSpot rate limits (per app/user).    
\- Strategy: \*\*exponential backoff with jitter\*\* (\`initial=250ms\`, \`max=60s\`, cap attempts).    
\- Circuit-breaker: open on consecutive 5xx; half-open probe after cooldown.

\#\#\# 1.5 Error Handling  
\- \*\*4xx\*\*: validate & correct; attach \`error\_code\`, \`field\`.    
\- \*\*5xx / network\*\*: retry with backoff; do not drop messages—park on DLQ after N retries and alert.    
\- Log \*\*redacted\*\* requests/responses (no tokens, no PII); include \`correlation\_id\`.

\#\#\# 1.6 Security  
\- OAuth or Private App token stored in secret manager; rotate regularly.    
\- Scope minimization: read/write contacts (+deals/companies if used).    
\- Webhook verification: validate signature; drop if invalid.

\---

\#\# 2\) CRM — Other Adapters (Stubs)

\#\#\# Salesforce / Pipedrive  
\- Mirror the HubSpot contract at \`/integrations/crm/{system}/upsert\` and \`/webhooks/crm/{system}\`.    
\- Provide mapping files in \`docs/integrations/{system}\_mapping.md\`.    
\- Maintain the same idempotency key strategy and event shapes.

\---

\#\# 3\) Booking — Acuity (Primary)

\#\#\# 3.1 Data Model Mapping  
| Platform Entity | Booking Field | Key Fields (→)                          | Notes |  
|---|---|---|---|  
| \`Booking\`       | Appointment   | → \`external\_id\`, \`start\_time\`, \`end\_time\`, \`status\`, \`client\_email\`, \`client\_phone\` | Normalize to UTC; map status to \`scheduled|completed|cancelled\` |  
| \`Client\`        | Derived       | → link by email/phone; fuzzy match ≥ 0.9 | Create client on first-seen w/ tenant scope |

\`Booking\` unique key: \`(system='acuity', external\_id)\`.

\#\#\# 3.2 Import API (Platform)  
\`POST /integrations/booking/acuity/import\`    
Body: \`{ tenant\_id, since?: iso8601, until?: iso8601, cursor?: string, idempotency\_key?, correlation\_id }\`    
Returns: \`{ imported, updated, skipped\_duplicates, next\_cursor }\`

\#\#\# 3.3 Idempotency & Dedup  
\- Key: \`sha256(tenant\_id \+ system \+ external\_id)\`    
\- If incoming record ≤ same version → noop.    
\- Duplicates produce \`skipped\_duplicates++\`.

\#\#\# 3.4 Rate Limits, Paging, Windows  
\- Use provider paging/cursors.    
\- Backoff on 429 with jitter.    
\- Default window: last 90d on first sync; subsequent: incremental since last \`synced\_at\`.

\#\#\# 3.5 Webhooks (If available)  
\`POST /webhooks/booking/acuity\` → validate signature → enqueue update → update \`Booking\` → emit \`booking.imported\` or \`booking.updated\`.

\#\#\# 3.6 Error Handling & Observability  
\- Same pattern as CRM.    
\- Metrics: \`bookings\_imported\`, \`bookings\_updated\`, \`skipped\_duplicates\`, \`errors\`, \`latency\_ms\_p95\`.    
\- Logs redacted; attach \`correlation\_id\`.

\---

\#\# 4\) Square / Vagaro (Optional)  
\- Reuse \`/integrations/booking/{system}/import\` and \`/webhooks/booking/{system}\`.    
\- Keep mapping files in \`docs/integrations/booking\_{system}\_mapping.md\`.

\---

\#\# 5\) Events (Emitted by Integrations)  
\- \`crm.synced\` — see Data\_Model\_and\_Events.md    
\- \`booking.imported\`, \`booking.updated\` — see Data\_Model\_and\_Events.md    
\- \`audit.logged\` — admin actions, integration config changes    
\- \`kpi.snapshot\` — downstream rollups

\---

\#\# 6\) Security & Privacy  
\- No raw PII in logs/events; tokenize email/phone.    
\- Secrets in secret manager; \`.env.example\` only in repo.    
\- Enforce \`tenant\_id\` on all queries and cache keys.

\---

\#\# 7\) Test Plan (tie to ATs)  
\- AT‑003 (CRM), AT‑004 (Booking) drive happy‑path and edge cases.    
\- Fixture dirs: \`tests/fixtures/crm/\*.json\`, \`tests/fixtures/bookings/\*.json\`.    
\- Include rate‑limit & webhook signature tests.

\---

\#\# 8\) Configuration  
\- \`.env.example\` keys: \`HUBSPOT\_TOKEN\`, \`ACUITY\_KEY\`, \`WEBHOOK\_SECRET\_\*\`, \`INTEGRATION\_TIMEOUT\_MS\`, \`BACKOFF\_MAX\_MS\`.

\*\*End — Integration\_Specs\_CRM\_and\_Booking.md\*\*

