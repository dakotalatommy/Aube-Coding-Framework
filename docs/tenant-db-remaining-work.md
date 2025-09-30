# Tenant Database Remaining Work

Use this checklist to finish the database hardening effort after the 2025‑09‑30 sweep. Complete each item in order and record the outcome in `docs/ui-v2-tenant-cleanup-plan.md`.

## 1. Supabase Console Security Settings

1. Sign in to the Supabase dashboard → Authentication → Providers → Email.
2. Set OTP expiry to **≤ 3600 seconds**.
3. Enable **Leaked password protection** (HaveIBeenPwned integration).
4. Capture before/after screenshots.
5. Log the date, operator, and screenshot paths in the cleanup plan.

## 2. Legacy Policy Rewrites (`auth_rls_initplan`)

1. Identify tables still using raw `current_setting()` expressions:

   ```sql
   SELECT schemaname, tablename, policyname, qual, with_check
   FROM pg_policies
   WHERE schemaname = 'public'
     AND (qual LIKE '%current_setting(%' OR with_check LIKE '%current_setting(%')
   ORDER BY tablename, policyname;
   ```

2. For each policy that still calls `current_setting()` directly, rewrite the predicate to use a subselect, e.g.:

   ```sql
   ALTER POLICY <policy_name> ON public.<table>
     USING ((select current_setting('app.tenant_id', true)::uuid) = tenant_id)
     WITH CHECK ((select current_setting('app.tenant_id', true)::uuid) = tenant_id);
   ```

   Adjust the expression as needed (admin bypass, service-role variants, etc.).

3. Re-run the policy listing to confirm no policies contain raw `current_setting()` calls.
4. Update the cleanup plan with table/policy names and timestamps.

## 3. Supabase Postgres Upgrade

1. From Supabase dashboard → Database → Settings, schedule the managed upgrade to the latest patch level (currently flagged from `supabase-postgres-17.4.1.074`).
2. Announce a maintenance window, monitor the upgrade, and record the completion time.
3. Verify application connectivity post-upgrade and note the new version in the plan.

## 4. Timestamp Conversions

1. Review `tmp/tenant-db-sweep-*/01_inventory.log` to find tables where `created_at`/`updated_at` remain `integer`/`bigint`.
2. For each table, convert columns to `timestamptz` (or `timestamp`) using a safe `ALTER TABLE` pattern, e.g.:

   ```sql
   ALTER TABLE public.calendar_events
     ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at),
     ALTER COLUMN updated_at TYPE timestamptz USING to_timestamp(updated_at);
   ```

3. Perform conversions during low-traffic windows; use transactions for large tables.
4. Document every conversion (table, columns, operator, timestamp) in the plan.

## 5. Advisor Validation

1. After completing the above tasks, run the Supabase Performance Advisor.
2. Export/report the new results; confirm previous warnings have cleared.
3. Capture screenshots and link them in the cleanup document.

## 6. Documentation & Artifacts

- Append all outcomes, screenshots, and remaining risks to `docs/ui-v2-tenant-cleanup-plan.md` under the latest status section.
- Store raw screenshots/logs in the agreed evidence location (e.g., `/docs/evidence/2025-09-XX/`).
- If any item cannot be completed, create a ticket describing the blocker and required follow-up.

Keep this file updated until every item above is finished.
