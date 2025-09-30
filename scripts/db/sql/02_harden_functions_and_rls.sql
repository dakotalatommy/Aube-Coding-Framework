-- 02_harden_functions_and_rls.sql
-- Applies deterministic search_path settings and rewrites RLS predicates.

SET statement_timeout = '30s';
SET lock_timeout = '5s';

-- 1. Force helper functions to use public, pg_temp search_path
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN (
    SELECT oid::regprocedure AS proc
    FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname IN ('_has_table', '_has_column', 'current_tenant_id', 'bootstrap_tenant')
  )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp;', rec.proc);
  END LOOP;
END$$;

-- 2. Re-write standard tenant policies to avoid per-row initplans
DO $$
DECLARE
  tenant_sql text := 'tenant_id = (select current_setting(''app.tenant_id'', true)::uuid)';
  admin_sql  text := '(select current_setting(''app.role'', true)) = ''owner_admin''';
  rec record;
BEGIN
  FOR rec IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('tenant_isolation', 'admin_bypass')
  LOOP
    IF rec.policyname = 'tenant_isolation' THEN
      EXECUTE format(
        'ALTER POLICY tenant_isolation ON public.%I USING (%s) WITH CHECK (%s);',
        rec.tablename, tenant_sql, tenant_sql
      );
    ELSE
      EXECUTE format(
        'ALTER POLICY admin_bypass ON public.%I USING (%s OR %s) WITH CHECK (%s OR %s);',
        rec.tablename, admin_sql, tenant_sql, admin_sql, tenant_sql
      );
    END IF;
  END LOOP;
END$$;

-- 3. Ensure a single service_role policy exists per tenant table
DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT DISTINCT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = pg_tables.tablename
          AND column_name = 'tenant_id'
      )
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = rec.tablename
        AND policyname = 'service_role_bypass'
    ) THEN
      EXECUTE format(
        'CREATE POLICY service_role_bypass ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
        rec.tablename
      );
    END IF;
  END LOOP;
END$$;
