-- Supabase SQL Hardening Script
-- Safe to run multiple times. Designed for Supabase roles: anon, authenticated, service_role
-- Focus:
-- 1) Enforce RLS on all public tables
-- 2) Ensure service_role bypass policy exists (full access) on all tables
-- 3) Revoke anon/Public write privileges (INSERT/UPDATE/DELETE) on public tables & sequences
-- 4) Optional: grant read-only to anon (commented out) — enable only if intended
-- 5) Helpers & diagnostics to find duplicate permissive policies and per-row function calls

-- =========================
-- 0) Preflight
-- =========================
set local statement_timeout = '30s';
set local lock_timeout = '5s';

-- =========================
-- 1) Enable RLS on all public tables
-- =========================
do $$
declare r record;
begin
  for r in (
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ) loop
    execute format('alter table %I.%I enable row level security', 'public', r.table_name);
    -- Optional: force RLS even for table owners (keeps behavior consistent)
    -- execute format('alter table %I.%I force row level security', 'public', r.table_name);
  end loop;
end$$;

-- =========================
-- 2) Ensure service_role bypass policy exists for all tables
--    This guarantees backend jobs can operate regardless of tenant/user RLS.
-- =========================
do $$
declare r record;
begin
  for r in (
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ) loop
    if not exists (
      select 1
      from pg_policies p
      where p.schemaname = 'public'
        and p.tablename  = r.table_name
        and p.policyname = 'service_role_bypass'
    ) then
      execute format(
        'create policy %I on %I.%I for all to %I using (true) with check (true)',
        'service_role_bypass', 'public', r.table_name, 'service_role'
      );
    end if;
  end loop;
end$$;

-- =========================
-- 3) Lock down anon/Public writes
-- =========================
revoke insert, update, delete on all tables in schema public from anon, public;
revoke usage, select, update on all sequences in schema public from anon, public;

-- Optional: If you want anonymous read access for marketing/demo content only,
-- uncomment this and then explicitly DENY via RLS on sensitive tables.
-- grant select on all tables in schema public to anon;

-- =========================
-- 4) Diagnostics helpers
-- =========================
-- 4a) List tables with multiple permissive policies per role/action (merge these into one)
-- select tablename, cmd, roles, count(*) as policy_count
-- from (
--   select pol.tablename, pol.cmd, unnest(pol.roles) as roles, pol.policyname
--   from pg_policies pol
--   where pol.schemaname = 'public'
-- ) t
-- group by tablename, cmd, roles
-- having count(*) > 1
-- order by tablename, cmd, roles;

-- 4b) Inspect RLS policies that likely call per-row functions (perf smell)
-- (Manually search policy expressions; rewrite auth.*()/current_setting() as subselects)
-- Example rewrite:
--   BEFORE: USING (auth.uid() = user_id)
--   AFTER:  USING ((select auth.uid()) = user_id)
--   BEFORE: USING ((current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::uuid = tenant_id)
--   AFTER:  USING (((select current_setting('request.jwt.claims', true))::jsonb->>'tenant_id')::uuid = tenant_id)

-- =========================
-- 5) Safety grants for authenticated (optional baseline)
--    RLS still controls actual row access. Only enable if your app expects DML grants.
-- =========================
-- grant select on all tables in schema public to authenticated;
-- grant insert, update, delete on all tables in schema public to authenticated;
-- grant usage, select on all sequences in schema public to authenticated;

-- =========================
-- 6) Quick report: RLS and policies by table
-- =========================
-- select n.nspname as schema,
--        c.relname as table,
--        c.relrowsecurity as rls_enabled,
--        c.relforcerowsecurity as rls_forced
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace
-- where n.nspname = 'public' and c.relkind = 'r'
-- order by c.relname;

-- select pol.schemaname, pol.tablename, pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check
-- from pg_policies pol
-- where pol.schemaname = 'public'
-- order by pol.tablename, pol.cmd, pol.policyname;

-- End of script


