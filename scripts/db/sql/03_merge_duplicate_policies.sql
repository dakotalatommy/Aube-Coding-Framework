-- 03_merge_duplicate_policies.sql
-- Consolidates multiple permissive policies per table/cmd/role. Run only after reviewing output.

SET statement_timeout = '30s';
SET lock_timeout = '5s';

DO $$
DECLARE g record;
DECLARE combined_qual text;
DECLARE combined_check text;
DECLARE pol_rec record;
BEGIN
  FOR g IN (
    SELECT tablename, cmd, role
    FROM (
      SELECT pol.tablename, pol.cmd, unnest(pol.roles) AS role
      FROM pg_policies pol
      WHERE pol.schemaname = 'public'
    ) x
    GROUP BY tablename, cmd, role
    HAVING count(*) > 1
       AND NOT EXISTS (
         SELECT 1
         FROM pg_policies p
         WHERE p.schemaname = 'public'
           AND p.tablename = x.tablename
           AND p.cmd = 'INSERT'
           AND p.policyname LIKE x.tablename || '_insert_public%'
       )
  ) LOOP
    SELECT string_agg(coalesce('(' || nullif(trim(qual), '') || ')','(true)'), ' OR ')
    INTO combined_qual
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = g.tablename AND p.cmd = g.cmd AND g.role = ANY(p.roles);

    SELECT string_agg(coalesce('(' || nullif(trim(with_check), '') || ')','(true)'), ' OR ')
    INTO combined_check
    FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = g.tablename AND p.cmd = g.cmd AND g.role = ANY(p.roles);

    IF combined_qual IS NULL THEN
      combined_qual := 'true';
    END IF;
    IF combined_check IS NULL THEN
      combined_check := 'true';
    END IF;

    FOR pol_rec IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname='public' AND tablename=g.tablename AND cmd=g.cmd AND g.role = ANY(roles)
    LOOP
      EXECUTE format('DROP POLICY %I ON %I.%I', pol_rec.policyname, 'public', g.tablename);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON %I.%I FOR %s TO %I USING (%s) WITH CHECK (%s)',
      g.tablename || '_' || g.cmd || '_' || g.role || '_merged',
      'public', g.tablename, g.cmd, g.role,
      combined_qual, combined_check
    );
  END LOOP;
END$$;
