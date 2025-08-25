-- Merge duplicate permissive RLS policies per table/role/action
-- Strategy: for each table+cmd+role with >1 policy, create one consolidated policy
-- using OR-combined predicates of existing policies, then drop the originals.
-- This is best-effort since pg_policies exposes qual/with_check text, not full AST.

set local statement_timeout = '30s';
set local lock_timeout = '5s';

-- 1) Identify duplicates (review)
-- SELECT tablename, cmd, roles, count(*) as policy_count
-- FROM (
--   SELECT pol.tablename, pol.cmd, unnest(pol.roles) as roles, pol.policyname
--   FROM pg_policies pol
--   WHERE pol.schemaname = 'public'
-- ) t
-- GROUP BY tablename, cmd, roles
-- HAVING count(*) > 1
-- ORDER BY tablename, cmd, roles;

-- 2) Consolidate per table+cmd+role
do $$
declare g record;
declare combined_qual text;
declare combined_check text;
begin
  for g in (
    select tablename, cmd, roles
    from (
      select pol.tablename, pol.cmd, unnest(pol.roles) as roles
      from pg_policies pol
      where pol.schemaname = 'public'
    ) x
    group by tablename, cmd, roles
    having count(*) > 1
  ) loop
    -- Build OR of USING predicates
    select string_agg(coalesce('(' || nullif(trim(qual), '' ) || ')','(true)'), ' OR ')
    into combined_qual
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = g.tablename and p.cmd = g.cmd and g.roles = any(p.roles);

    -- Build OR of WITH CHECK predicates
    select string_agg(coalesce('(' || nullif(trim(with_check), '' ) || ')','(true)'), ' OR ')
    into combined_check
    from pg_policies p
    where p.schemaname = 'public' and p.tablename = g.tablename and p.cmd = g.cmd and g.roles = any(p.roles);

    -- Drop existing policies for this group
    perform 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = g.tablename and p.cmd = g.cmd and g.roles = any(p.roles);
    if found then
      for p in select policyname from pg_policies p where p.schemaname='public' and p.tablename=g.tablename and p.cmd=g.cmd and g.roles = any(p.roles)
      loop
        execute format('drop policy %I on %I.%I', p.policyname, 'public', g.tablename);
      end loop;
    end if;

    -- Create consolidated policy
    execute format(
      'create policy %I on %I.%I for %s to %I using (%s) with check (%s)',
      g.tablename || '_' || g.cmd || '_' || g.roles || '_merged', 'public', g.tablename, g.cmd, g.roles,
      coalesce(combined_qual, 'true'), coalesce(combined_check, 'true')
    );
  end loop;
end$$;

-- Verify
-- SELECT pol.schemaname, pol.tablename, pol.policyname, pol.cmd, pol.roles
-- FROM pg_policies pol
-- WHERE pol.schemaname = 'public'
-- ORDER BY pol.tablename, pol.cmd, pol.policyname;


