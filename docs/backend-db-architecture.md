Backend Database & RLS Playbook (Internal)

Executive summary
- We use Postgres (Supabase) with RLS. All tenant-scoped writes/critical reads must use short‑lived connections that set per‑request GUCs via bound SQL text: SET LOCAL app.tenant_id, SET LOCAL app.role. Never hold a Session transaction across network calls. Never swallow DB exceptions in loops.

High-level architecture
- API (FastAPI + SQLAlchemy) → Supabase Postgres via dedicated pooler (sslmode=require)
- RLS GUCs: app.tenant_id (UUID), app.role (e.g., owner_admin)
- Tokens: connected_accounts_v2 is canonical; legacy table has been retired
- Timestamps: some tables use timestamptz; others use bigint epoch. Use adaptive expressions to stay compatible (NOW() vs EXTRACT(EPOCH FROM now())::bigint)

Starting point and symptoms (incident recap)
- Symptoms: imports fetched 759 customers but created 0; earlier SSL disconnects; “missing_access_token” due to RLS reads; silent transaction aborts
- Root issues: SET LOCAL issued with exec_driver_sql + placeholders (syntax error) → aborted txn; Session-level GUCs held across network fetch; swallowed DB errors; schema drift (timestamptz vs bigint)

Root causes and fixes
- GUCs must be set via bound text on the exact connection used for the write; failures must surface (never silently "pass")
- Short-lived with_rls_conn_do helper; one retry on OperationalError
- Adaptive timestamps on insert/update
- Robust token fetch (v2 short-lived conn with retry)
- Expose write errors; emit ImportWriteError; diagnostics probes added

Golden rules (do/don’t)
- Do: short-lived connection per write; SET LOCAL via bound text() executes on the active connection
- Don’t: hold Session transactions over provider network calls
- Do: adaptive timestamp expressions; idempotent imports; post-import count check
- Don’t: swallow DB exceptions in loops or around `SET LOCAL`; always emit (and log) the real error

Standard patterns (snippets)
- with_rls_conn_do(engine, tenant_id, role='owner_admin') with one-retry for transient disconnects
- token_fetch(provider='square'|'acuity'): v2 conn first; session fallback if needed
- insert/update template using NOW() vs EXTRACT(EPOCH FROM now())::bigint chosen at runtime by information_schema

RLS GUC implementation pattern (must-follow)
- Always obtain the real connection from `engine.begin()` and set GUCs before any tenant-scoped SQL.
- Never wrap `SET LOCAL` in a blanket try/except that swallows the error; log and fail fast so Render logs surface the Postgres error message.
- Example (mirrors the production helper used by Square/Acuity imports):
  ```python
  @contextmanager
  def _with_conn(tenant_id: str, role: str = "owner_admin"):
      conn_cm = engine.begin()
      try:
          conn = conn_cm.__enter__()
          safe_role = role.replace("'", "''")
          conn.execute(text(f"SET LOCAL app.role = '{safe_role}'"))
          safe_tenant = tenant_id.replace("'", "''")
          conn.execute(text(f"SET LOCAL app.tenant_id = '{safe_tenant}'"))
          yield conn
      finally:
          conn_cm.__exit__(None, None, None)
  ```
- Tests/diagnostics should call helpers that use this pattern (e.g., `/integrations/booking/acuity/debug-fetch`). If the helper raises, check Render logs for `Failed to set app.role GUC` or similar and fix the GUC logic before chasing secrets/keys.

Verified GUC Patterns (Production-Tested)

Pattern 1: Short-Lived Transaction Write (RECOMMENDED)
Used by: Square/Acuity imports, AI memory writes, tool operations

```python
with engine.begin() as conn:
    conn.execute(_sql_text("SET LOCAL app.role = 'owner_admin'"))
    conn.execute(_sql_text("SET LOCAL app.tenant_id = :t"), {"t": tenant_id})
    # Perform writes
    conn.execute(_sql_text("INSERT INTO ..."), {...})
# Transaction auto-commits on context exit
```

When to use: Single-operation writes, API endpoints, tool functions

Pattern 2: Background Worker Job Processing
Used by: Batch message generation, import jobs, AI insights

```python
def _acquire_job_id():
    with engine.begin() as conn:
        conn.execute(_sql_text("SELECT set_config('app.role', :role, true)"), {"role": "owner_admin"})
        # Acquire job with FOR UPDATE SKIP LOCKED
        row = conn.execute(_sql_text("SELECT id, tenant_id FROM jobs WHERE ...")).fetchone()
        if row:
            tenant_id = str(row[1])
            conn.execute(_sql_text("SELECT set_config('app.tenant_id', :t, true)"), {"t": tenant_id})
        # Process job within tenant context
```

When to use: Long-running async jobs, worker processes

Pattern 3: SQLAlchemy Parameter Binding (CRITICAL)
NEVER use `::type` syntax with named parameters

❌ WRONG:
```python
conn.execute(_sql_text("INSERT ... VALUES (:param::jsonb)"), {"param": value})
# Error: psycopg2.errors.SyntaxError at ":"
```

✅ CORRECT:
```python
conn.execute(_sql_text("INSERT ... VALUES (CAST(:param AS jsonb))"), {"param": value})
# Works: CAST() syntax doesn't interfere with parameter substitution
```

All JSONB writes must use `CAST(:param AS jsonb)` instead of `:param::jsonb`

Provider guides
- Square: endpoints, headers, events (OauthTokenSaved, ContactsSynced, ImportWriteError), diagnostics (selfcheck, probe insert/delete, import trigger)
- Acuity: same pattern and diagnostics; seed test plan to validate end‑to‑end

Diagnostics & playbooks
- Endpoints: /integrations/rls/selfcheck, /integrations/rls/probe-insert-contact, /integrations/rls/probe-delete-contact, /integrations/booking/{square|acuity}/sync-contacts, /integrations/status, /integrations/events
- Token probes (Square/Acuity): /integrations/booking/acuity/debug-token, /integrations/booking/acuity/debug-fetch, /integrations/booking/acuity/debug-headers (same structure exists for Square). Expect `token_present=true` post-connect; if false, check Render logs for GUC failures before rotating secrets.
- Admin inspection: /admin/schema/inspect (owner_admin only) — returns:
  - rls_tables: list of public tables and whether RLS is enabled
  - policies: policy list with quals/with_check
  - gucs_referenced: any app.* GUCs referenced by policies
  - timestamps: per-table created_at/updated_at data types
  - audit_logs_has_payload: whether payload column exists
- Decision tree: 401 → auth; missing_access_token → token read/RLS; created=0 → write error/aborted txn; SSL closed → idle-in-transaction timeout
- Logs to check (in order): Supabase Postgres logs → Render logs → diagnostics endpoints → policy SQL in Supabase

Cascade troubleshooting flow (run in this exact order)
1. RLS first: call `/integrations/booking/<prov>/debug-rls`. If `guc_tenant` mismatches or endpoint errors, fix GUCs on the exact connection before doing anything else.
2. Row visibility: call `/integrations/booking/<prov>/debug-token` and `/debug-token-lens`. If no row or `len_enc=0`, the connect/write path failed.
3. Token fetch: call `/integrations/booking/<prov>/debug-fetch`. If `token_present=false` but lens shows `len_enc>0`, simplify the fetch to "newest non‑empty access_token_enc, decrypt‑or‑raw" (Square pattern) and re-verify GUCs.
4. Headers: call `/integrations/booking/<prov>/debug-headers`. Must be `bearer` before running imports. If `basic`, re-check fetch.
5. Import: run the provider import (or status) to confirm 2xx. Only after steps 1‑4 pass should you consider secrets/refresh/rotation.

Schema & timestamp policy
- Canonical forward: prefer timestamptz for created_at/updated_at
- Maintain adaptive writes while bigint remains; plan safe migration later

Verification checklist (PR + release)
- RLS: uses short‑lived helper; SET LOCAL via bound text; no session-held transactions over network
- Timestamps: adaptive expression on inserts/updates
- Tokens: v2 only (short-lived conn, session fallback acceptable)
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
 - Acuity token presence: curl -H "Authorization: Bearer <token>" "https://api.brandvx.io/integrations/booking/acuity/debug-token?tenant_id=<tid>"
 - Acuity token length: curl -H "Authorization: Bearer <token>" "https://api.brandvx.io/integrations/booking/acuity/debug-token-lens?tenant_id=<tid>&limit=5"
 - Acuity token fetch: curl -H "Authorization: Bearer <token>" "https://api.brandvx.io/integrations/booking/acuity/debug-fetch?tenant_id=<tid>"
 - Acuity headers mode: curl -H "Authorization: Bearer <token>" "https://api.brandvx.io/integrations/booking/acuity/debug-headers?tenant_id=<tid>"
 - Acuity RLS probe: curl -H "Authorization: Bearer <token>" "https://api.brandvx.io/integrations/booking/acuity/debug-rls?tenant_id=<tid>"

Current inspection snapshot (production)
- GUCs referenced in RLS policies: app.tenant_id, app.role
- RLS: enabled across all tenant tables; exception observed: client_images (rls=false)
- Timestamp columns by type:
  - bigint: contacts.created_at/updated_at; inventory_items.updated_at; inventory_summary.updated_at; calendar_events.created_at
  - integer: client_images.created_at; inbox_messages.created_at; share_links.created_at
  - timestamptz: most other tables (appointments, audit_logs, messages, settings, tenants, etc.)
- audit_logs.payload present: false (keep _safe_audit_log tolerant writer)

Impact if not following patterns
- Missing/incorrect SET LOCAL on the write connection → transaction aborts; imports become no-op (created=0)
- Non-adaptive timestamps → type errors against timestamptz/bigint columns; txn abort cascades
- Swallowed DB exceptions → symptoms masked (e.g., fetched N, created 0)
- Non-robust token read → false “missing_access_token” under RLS

Onboarding checklist for new backend contributors
- Read this playbook end-to-end before touching provider code; replicate the `_with_conn` pattern in any new helper.
- When debugging “missing token” or “created 0” issues, run the token/rls debug endpoints first and inspect Render logs for surfaced GUC errors.
- Never rotate secrets until you’ve confirmed RLS visibility—if `token_present` is false but logs show a GUC failure, fix the helper and re-run the probe.

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
