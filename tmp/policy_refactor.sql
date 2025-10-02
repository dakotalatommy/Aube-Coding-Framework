DO $policy$
DECLARE
  rec record;
  read_using text;
  write_check text;
BEGIN
  FOR rec IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'ALL'
      AND roles @> ARRAY['public']::name[]
  LOOP
    read_using := COALESCE(rec.qual, 'true');
    write_check := COALESCE(rec.with_check, rec.qual, 'true');

    EXECUTE format('DROP POLICY %I ON public.%I', rec.policyname, rec.tablename);

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = rec.tablename
        AND cmd = 'SELECT'
        AND roles @> ARRAY['public']::name[]
    ) THEN
      EXECUTE format('CREATE POLICY %I_select_public ON public.%I FOR SELECT TO public USING (%s);',
                     rec.tablename, rec.tablename, read_using);
    END IF;

    EXECUTE format('CREATE POLICY %I_insert_public ON public.%I FOR INSERT TO public WITH CHECK (%s);',
                   rec.tablename, rec.tablename, write_check);

    EXECUTE format('CREATE POLICY %I_update_public ON public.%I FOR UPDATE TO public USING (%s) WITH CHECK (%s);',
                   rec.tablename, rec.tablename, read_using, write_check);

    EXECUTE format('CREATE POLICY %I_delete_public ON public.%I FOR DELETE TO public USING (%s);',
                   rec.tablename, rec.tablename, read_using);
  END LOOP;
END
$policy$;
