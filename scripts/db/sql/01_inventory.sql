-- 01_inventory.sql
-- Baseline visibility queries (non-destructive). Run with psql -f to capture output.

\pset footer off
\pset format aligned

-- 1. List all public tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Flag tables not on the keep-list
WITH keep(table_name) AS (
  VALUES
    ('tenants'), ('settings'), ('onboarding_progress'), ('onboarding_artifacts'),
    ('jobs'), ('activity_log'), ('askvx_messages'), ('trainvx_memories'),
    ('ai_memories'), ('cadence_states'), ('messages'), ('appointments'),
    ('calendar_events'), ('inventory_items'), ('inventory_summary'),
    ('connected_accounts_v2'), ('support_tickets'), ('referral_codes'),
    ('referrals'), ('plans'), ('usage_limits'), ('todo_items'),
    ('plan_14day'), ('ai_global_insights'), ('ai_global_faq'),
    ('time_saved_rollup'), ('funnel_daily')
)
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
EXCEPT SELECT table_name FROM keep
ORDER BY table_name;

DO $$
BEGIN
  IF to_regclass('pg_temp.tmp_cadence_counts') IS NULL THEN
    EXECUTE 'CREATE TEMP TABLE tmp_cadence_counts(table_name text, rows bigint)';
  ELSE
    EXECUTE 'TRUNCATE tmp_cadence_counts';
  END IF;

  BEGIN
    EXECUTE 'INSERT INTO tmp_cadence_counts SELECT ''cadence_state'', COUNT(*) FROM public.cadence_state';
  EXCEPTION
    WHEN undefined_table THEN
      INSERT INTO tmp_cadence_counts VALUES ('cadence_state_missing', NULL);
  END;

  BEGIN
    EXECUTE 'INSERT INTO tmp_cadence_counts SELECT ''cadence_states'', COUNT(*) FROM public.cadence_states';
  EXCEPTION
    WHEN undefined_table THEN
      INSERT INTO tmp_cadence_counts VALUES ('cadence_states_missing', NULL);
  END;
END$$;

SELECT * FROM tmp_cadence_counts;
DROP TABLE IF EXISTS tmp_cadence_counts;

-- 4. Token store inventory
SELECT provider, COUNT(*) AS accounts
FROM connected_accounts_v2
GROUP BY provider
ORDER BY provider;
SELECT COUNT(*) AS legacy_accounts FROM connected_accounts;

-- 5. Critical table counts
SELECT 'support_tickets' AS table_name, COUNT(*) AS rows FROM support_tickets
UNION ALL
SELECT 'askvx_messages', COUNT(*) FROM askvx_messages
UNION ALL
SELECT 'trainvx_memories', COUNT(*) FROM trainvx_memories
UNION ALL
SELECT 'plan_14day', COUNT(*) FROM plan_14day;

-- 6. Timestamp type spot check
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND column_name IN ('created_at','updated_at')
ORDER BY table_name, column_name;
