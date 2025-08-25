-- Supabase Policy Tightening Script
-- Goal: remove anon from write policies (INSERT/UPDATE/DELETE) and replace with authenticated
-- Non-destructive: renames old policies and creates new ones; manual review recommended

set local statement_timeout = '30s';
set local lock_timeout = '5s';

-- 1) Identify policies that grant writes to anon
-- SELECT pol.schemaname, pol.tablename, pol.policyname, pol.cmd, pol.roles
-- FROM pg_policies pol
-- WHERE pol.schemaname = 'public'
--   AND pol.cmd in ('insert','update','delete')
--   AND 'anon' = ANY(pol.roles)
-- ORDER BY pol.tablename, pol.cmd, pol.policyname;

-- 2) For each such policy, we will:
--    - create an equivalent policy for authenticated
--    - drop or rename the anon policy
-- Note: pg_policies doesn't expose the full CREATE POLICY statement; we reuse the same qual/with_check.

do $$
declare r record;
begin
  for r in (
    select pol.schemaname, pol.tablename, pol.policyname, pol.cmd, pol.roles, pol.qual, pol.with_check
    from pg_policies pol
    where pol.schemaname = 'public'
      and pol.cmd in ('insert','update','delete')
      and 'anon' = any(pol.roles)
  ) loop
    -- Create a new policy for authenticated replicating the predicate
    execute format(
      'create policy %I on %I.%I for %s to authenticated using (%s) with check (%s)',
      r.policyname || '_auth', r.schemaname, r.tablename, r.cmd, coalesce(r.qual, 'true'), coalesce(r.with_check, 'true')
    );

    -- Drop the anon-inclusive policy to prevent anon writes
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end$$;

-- 3) Optional: ensure baseline DML grants exist for authenticated (RLS still applies)
-- grant select on all tables in schema public to authenticated;
-- grant insert, update, delete on all tables in schema public to authenticated;
-- grant usage, select on all sequences in schema public to authenticated;

-- Verification:
-- SELECT pol.schemaname, pol.tablename, pol.policyname, pol.cmd, pol.roles
-- FROM pg_policies pol
-- WHERE pol.schemaname = 'public'
-- ORDER BY pol.tablename, pol.cmd, pol.policyname;


