Backend Database & RLS Playbook (Internal)

Executive summary
- We use Postgres (Supabase) with RLS. All tenant-scoped writes/critical reads must use short‑lived connections that set per‑request GUCs via bound SQL text: SET LOCAL app.tenant_id, SET LOCAL app.role. Never hold a Session transaction across network calls. Never swallow DB exceptions in loops.

High-level architecture
- API (FastAPI + SQLAlchemy) → Supabase Postgres via dedicated pooler (sslmode=require)
- RLS GUCs: app.tenant_id (UUID), app.role (e.g., owner_admin)
- Tokens: connected_accounts_v2 is canonical; legacy table is optional fallback during migration only
- Timestamps: some tables use timestamptz; others use bigint epoch. Use adaptive expressions to stay compatible (NOW() vs EXTRACT(EPOCH FROM now())::bigint)

Starting point and symptoms (incident recap)
- Symptoms: imports fetched 759 customers but created 0; earlier SSL disconnects; “missing_access_token” due to RLS reads; silent transaction aborts
- Root issues: SET LOCAL issued with exec_driver_sql + placeholders (syntax error) → aborted txn; Session-level GUCs held across network fetch; swallowed DB errors; schema drift (timestamptz vs bigint)

Root causes and fixes
- GUCs must be set via bound text on the exact connection used for the write
- Short‑lived with_rls_conn_do helper; one retry on OperationalError
- Adaptive timestamps on insert/update
- Robust token fetch (v2 conn → session fallback; optional legacy fallback)
- Expose write errors; emit ImportWriteError; diagnostics probes added

Golden rules (do/don’t)
- Do: short‑lived connection per write; SET LOCAL via bound text() executes
- Don’t: hold Session transactions over provider network calls
- Do: adaptive timestamp expressions; idempotent imports; post‑import count check
- Don’t: swallow DB exceptions in loops; always emit an event

Standard patterns (snippets)
- with_rls_conn_do(engine, tenant_id, role='owner_admin') with one‑retry for transient disconnects
- token_fetch(provider='square'|'acuity'): v2 conn first; session fallback; legacy optional
- insert/update template using NOW() vs EXTRACT(EPOCH FROM now())::bigint chosen at runtime by information_schema

Provider guides
- Square: endpoints, headers, events (OauthTokenSaved, ContactsSynced, ImportWriteError), diagnostics (selfcheck, probe insert/delete, import trigger)
- Acuity: same pattern and diagnostics; seed test plan to validate end‑to‑end

Diagnostics & playbooks
- Endpoints: /integrations/rls/selfcheck, /integrations/rls/probe-insert-contact, /integrations/rls/probe-delete-contact, /integrations/booking/{square|acuity}/sync-contacts, /integrations/status, /integrations/events
- Admin inspection: /admin/schema/inspect (owner_admin only) — returns:
  - rls_tables: list of public tables and whether RLS is enabled
  - policies: policy list with quals/with_check
  - gucs_referenced: any app.* GUCs referenced by policies
  - timestamps: per-table created_at/updated_at data types
  - audit_logs_has_payload: whether payload column exists
- Decision tree: 401 → auth; missing_access_token → token read/RLS; created=0 → write error/aborted txn; SSL closed → idle-in-transaction timeout
- Logs to check (in order): Supabase Postgres logs → Render logs → diagnostics endpoints → policy SQL in Supabase

Schema & timestamp policy
- Canonical forward: prefer timestamptz for created_at/updated_at
- Maintain adaptive writes while bigint remains; plan safe migration later

Verification checklist (PR + release)
- RLS: uses short‑lived helper; SET LOCAL via bound text; no session-held transactions over network
- Timestamps: adaptive expression on inserts/updates
- Tokens: v2 first; session fallback; legacy optional
- Errors: no swallowed exceptions; Sentry + events emitted
- Events: OauthTokenSaved, ContactsSynced, ImportWriteError, CalendarSynced, ConnectorsNormalized/Cleaned

Appendix A: SQL (run in Supabase SQL editor)
- List RLS policies for a table: SELECT * FROM pg_policies WHERE tablename = 'contacts';
- Check if RLS is enabled: SELECT relrowsecurity FROM pg_class WHERE relname='contacts';
- Discover columns + types (timestamps): SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name IN ('created_at','updated_at');
- Search all tables for created_at/updated_at types: SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND column_name IN ('created_at','updated_at') ORDER BY table_name;
- Verify GUCs in session: SHOW application_name; (GUC values are local only; validate by attempting tenant‑scoped SELECT after SET LOCAL)

Appendix B: curl diagnostics (examples)
- Selfcheck: curl -H "Authorization: Bearer <token>" "https://api.brandvx.io/integrations/rls/selfcheck"
- Probe insert: curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d '{"tenant_id":"<tid>"}' "https://api.brandvx.io/integrations/rls/probe-insert-contact"
- Probe delete: curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d '{"tenant_id":"<tid>","contact_id":"probe:<id>"}' "https://api.brandvx.io/integrations/rls/probe-delete-contact"
- Import: curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d '{"tenant_id":"<tid>"}' "https://api.brandvx.io/integrations/booking/square/sync-contacts"
- Admin inspect: curl -H "Authorization: Bearer <token>" "https://api.brandvx.io/admin/schema/inspect"

Current inspection snapshot (production)
- GUCs referenced in RLS policies: app.tenant_id, app.role
- RLS: enabled across all tenant tables; exception observed: client_images (rls=false)
- Timestamp columns by type:
  - bigint: contacts.created_at/updated_at; inventory_items.updated_at; inventory_summary.updated_at; calendar_events.created_at
  - integer: client_images.created_at; inbox_messages.created_at; share_links.created_at
  - timestamptz: most other tables (appointments, audit_logs, messages, settings, tenants, etc.)
- audit_logs.payload present: false (keep _safe_audit_log tolerant writer)

Impact if not following patterns
- Missing/incorrect SET LOCAL on the write connection → transaction aborts; imports become no‑op (created=0)
- Non‑adaptive timestamps → type errors against timestamptz/bigint columns; txn abort cascades
- Swallowed DB exceptions → symptoms masked (e.g., fetched N, created 0)
- Non‑robust token read → false “missing_access_token” under RLS

Optional Appendix C: Timestamp migration runbook (bigint/integer → timestamptz)
Purpose
- Standardize created_at/updated_at to timestamptz. Safe with our adaptive writes; do off‑peak.

Order:
- contacts → calendar_events → inventory_items → inventory_summary → client_images → inbox_messages → share_links

Pre‑check (optional example for contacts):
```sql
select min(created_at) as min_epoch, max(created_at) as max_epoch,
       min(to_timestamp(created_at)) as min_ts, max(to_timestamp(created_at)) as max_ts
from public.contacts;
```

Migrations (run one table at a time)
- contacts
```sql
alter table public.contacts
  alter column created_at type timestamptz using to_timestamp(created_at),
  alter column updated_at type timestamptz using to_timestamp(updated_at),
  alter column created_at set default now(),
  alter column updated_at set default now();
```
- calendar_events
```sql
alter table public.calendar_events
  alter column created_at type timestamptz using to_timestamp(created_at),
  alter column created_at set default now();
```
- inventory_items
```sql
alter table public.inventory_items
  alter column updated_at type timestamptz using to_timestamp(updated_at),
  alter column updated_at set default now();
```
- inventory_summary
```sql
alter table public.inventory_summary
  alter column updated_at type timestamptz using to_timestamp(updated_at),
  alter column updated_at set default now();
```
- client_images
```sql
alter table public.client_images
  alter column created_at type timestamptz using to_timestamp(created_at),
  alter column created_at set default now();
```
- inbox_messages
```sql
alter table public.inbox_messages
  alter column created_at type timestamptz using to_timestamp(created_at),
  alter column created_at set default now();
```
- share_links
```sql
alter table public.share_links
  alter column created_at type timestamptz using to_timestamp(created_at),
  alter column created_at set default now();
```

Verification after each table
- Call: `GET /admin/schema/inspect` and confirm the table’s created_at/updated_at show “timestamp with time zone”.
- For contacts only: run a probe insert and list:
```bash
curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer <token>" \
  -d '{"tenant_id":"<tid>"}' https://api.brandvx.io/integrations/rls/probe-insert-contact

curl -H "Authorization: Bearer <token>" \
  "https://api.brandvx.io/contacts/list?tenant_id=<tid>&limit=1"
```

Rollback note
- If needed, you can convert back using `extract(epoch from created_at)::bigint`, but this shouldn’t be necessary.


