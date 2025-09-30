# Tenant Database Sweep Runbook

This guide explains how to execute the tenant database cleanup, security hardening, and Supabase advisory remediations. Follow the steps in order; capture the console output for every command.

## 0. Prerequisites

- Supabase service-role key with database write access.
- Local `psql` client (v15+). If unavailable, use the Supabase SQL editor and paste the SQL blocks individually.
- Recent Supabase backup or snapshot.
- Repository up to date, including the helper script `scripts/db/tenant_sweep.sh` and SQL files under `scripts/db/sql/`.

## 1. Connect

```bash
export SUPABASE_DB_URL='postgres://postgres:<service_role_key>@db.dwfvnqajrwruprqbjxph.supabase.co:6543/postgres'
export PGPASSWORD='<service_role_key>'
psql "$SUPABASE_DB_URL" -c 'select now();'
```

If the command succeeds, you are ready to continue. Otherwise, verify networking and credentials.

## 2. Recommended Execution Path

Run the orchestrator script to capture all required steps:

```bash
RUN_INDEX_CLEANUP=0 \  # set to 1 only after reviewing the DROP list
RUN_POLICY_MERGE=1 \   # disable with 0 if you want to skip consolidation
./scripts/db/tenant_sweep.sh "$SUPABASE_DB_URL"
```

The script produces timestamped logs in `tmp/tenant-db-sweep-<timestamp>/`. Review the files in order:

1. `01_inventory.log` – table inventory, keep-list comparison, cadence sanity, token counts, timestamp audit.
2. `02_harden_functions_and_rls.log` – function `search_path` fixes and RLS predicate rewrite.
3. `03_merge_duplicate_policies.log` – consolidation of overlapping policies (only when `RUN_POLICY_MERGE=1`).
4. `04_index_cleanup_and_fk.log` – duplicate index drops and FK coverage additions (only when `RUN_INDEX_CLEANUP=1`).

### Manual follow-up

- Inspect the `EXCEPT` result in `01_inventory.log`; archive or drop legacy tables separately once reviewed.
- Confirm the cadence view (`cadence_state`) exists if downstream code still references the singular name.
- If `connected_accounts` still contains rows, plan a data migration before dropping the table.

## 3. Auth Setting Adjustments

In the Supabase dashboard (Authentication → Settings):

1. Reduce OTP expiry to less than 3600 seconds.
2. Enable leaked password protection.

Document the change date and operator in `docs/ui-v2-tenant-cleanup-plan.md`.

## 4. Timestamp Conversions

The timestamp audit in `01_inventory.log` highlights columns still using integer/bigint. Convert them using targeted migrations or manual `ALTER TABLE ... USING` statements. Record each change in the cleanup plan document.

## 5. Re-run Supabase Performance Advisor

After the script completes and any manual drops/conversions are finished:

1. Open Supabase → Database → Monitoring → Advisors.
2. Capture screenshots before and after.
3. Confirm that the following warnings are resolved:
   - `function_search_path_mutable`
   - `auth_rls_initplan`
   - `multiple_permissive_policies`
   - `duplicate_index`

Investigate any remaining items (e.g., truly unused indexes) and schedule follow-up actions.

## 6. Documentation Checklist

Update `docs/ui-v2-tenant-cleanup-plan.md` with:

- Auth setting changes.
- Function `search_path` hardening confirmation.
- RLS predicate refactor and service-role policy audit.
- Indexes dropped/kept and rationale.
- Tables archived/dropped or views created.
- Outstanding timestamp conversions (with owners and target dates).

## 7. Automated Pipeline Option

A GitHub Actions workflow (`.github/workflows/tenant-db-sweep.yml`) is included for on-demand runs. To use it:

1. Add repository secrets:
   - `SUPABASE_DB_URL` – full Postgres connection string.
   - `SUPABASE_DB_PASSWORD` – duplicated service-role key for `PGPASSWORD` (or leave blank if embedded in the URL).
2. Trigger `Tenant DB Sweep` from the “Actions” tab.
3. Choose whether to enable duplicate policy merge/index cleanup via inputs.
4. Download and review the uploaded artifact (`tenant-db-sweep/`).

> ⚠️ The workflow modifies the production database. Require approvals and schedule a maintenance window before dispatching the action.

## 8. Escalation

If any SQL step fails:

1. Capture the error output.
2. Roll back the transaction (`ROLLBACK`) when inside `psql` and the error occurs mid script.
3. Notify the on-call engineer and halt further steps until resolved.

## 9. Ready-to-Run Prompt for Automation Agents

If you are delegating the execution to another automation agent that has database access, provide the prompt in the main task description. A ready-made prompt is available in the main PR/issue description (see below). Ensure the agent stores the generated logs and reports back with confirmations and screenshots.

---

Follow this runbook precisely to keep the tenant database consistent and compliant with Supabase best practices.
