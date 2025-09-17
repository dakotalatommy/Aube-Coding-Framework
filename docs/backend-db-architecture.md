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


