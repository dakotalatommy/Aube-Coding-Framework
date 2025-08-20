from alembic import op
import sqlalchemy as sa


revision = '0009_supabase_alignment'
down_revision = '0008_db_cohesion'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # Helper to run conditional alter blocks safely
    def run(sql: str) -> None:
        conn.execute(sa.text(sql))

    # Helper to drop policies on a table (Postgres only)
    def drop_policies(table: str) -> None:
        if conn.dialect.name != 'postgresql':
            return
        run(
            f"""
            DO $$
            DECLARE r record;
            BEGIN
              FOR r IN (
                SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='{table}'
              ) LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.{table}', r.policyname);
              END LOOP;
            END $$;
            """
        )

    def recreate_policies(table: str) -> None:
        # Recreate tenant_isolation and admin_bypass (Postgres only)
        if conn.dialect.name != 'postgresql':
            return
        run(
            f"""
            CREATE POLICY tenant_isolation ON public.{table}
              USING (tenant_id::text = current_setting('app.tenant_id', true))
              WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));
            CREATE POLICY admin_bypass ON public.{table}
              USING (current_setting('app.role', true) = 'owner_admin' OR tenant_id::text = current_setting('app.tenant_id', true))
              WITH CHECK (current_setting('app.role', true) = 'owner_admin' OR tenant_id::text = current_setting('app.tenant_id', true));
            """
        )

    # Approvals: drop policies → alter → recreate; created_at -> timestamptz
    drop_policies('approvals')
    if conn.dialect.name == 'postgresql':
        run(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='approvals' AND column_name='tenant_id' AND data_type <> 'uuid'
              ) THEN
                ALTER TABLE public.approvals ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
              END IF;
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='approvals' AND column_name='created_at' AND data_type='integer'
              ) THEN
                ALTER TABLE public.approvals ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at);
              END IF;
            END $$;
            """
        )
    recreate_policies('approvals')

    # Cadence states: tenant_id/contact_id -> text ok for now; keep next_action_epoch int; created_at -> timestamptz
    if conn.dialect.name == 'postgresql':
        run(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='cadence_states' AND column_name='created_at' AND data_type='integer'
              ) THEN
                ALTER TABLE public.cadence_states ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at);
              END IF;
            END $$;
            """
        )

    # Lead status: already uuid/timestamptz in Supabase; ensure next_action_at is timestamptz
    if conn.dialect.name == 'postgresql':
        run(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='lead_status' AND column_name='next_action_at' AND data_type='integer'
              ) THEN
                ALTER TABLE public.lead_status ALTER COLUMN next_action_at TYPE timestamptz USING to_timestamp(next_action_at);
              END IF;
            END $$;
            """
        )

    # Settings: drop policies → alter → recreate; created_at -> timestamptz
    drop_policies('settings')
    if conn.dialect.name == 'postgresql':
        run(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='settings' AND column_name='tenant_id' AND data_type <> 'uuid'
              ) THEN
                ALTER TABLE public.settings ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
              END IF;
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='settings' AND column_name='created_at' AND data_type='integer'
              ) THEN
                ALTER TABLE public.settings ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at);
              END IF;
            END $$;
            """
        )
    recreate_policies('settings')

    # Events ledger: drop policies → alter → recreate; ts -> timestamptz, tenant_id -> uuid
    drop_policies('events_ledger')
    if conn.dialect.name == 'postgresql':
        run(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='events_ledger' AND column_name='tenant_id' AND data_type <> 'uuid'
              ) THEN
                ALTER TABLE public.events_ledger ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
              END IF;
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='events_ledger' AND column_name='ts' AND data_type='integer'
              ) THEN
                ALTER TABLE public.events_ledger ALTER COLUMN ts TYPE timestamptz USING to_timestamp(ts);
              END IF;
            END $$;
            """
        )
    recreate_policies('events_ledger')

    # Metrics: drop policies → alter → recreate; tenant_id -> uuid, created_at -> timestamptz
    drop_policies('metrics')
    if conn.dialect.name == 'postgresql':
        run(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='metrics' AND column_name='tenant_id' AND data_type <> 'uuid'
              ) THEN
                ALTER TABLE public.metrics ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
              END IF;
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='metrics' AND column_name='created_at' AND data_type='integer'
              ) THEN
                ALTER TABLE public.metrics ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at);
              END IF;
            END $$;
            """
        )
    recreate_policies('metrics')

    # Chat logs: drop policies → alter → recreate; tenant_id -> uuid, created_at -> timestamptz
    drop_policies('chat_logs')
    if conn.dialect.name == 'postgresql':
        run(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='chat_logs' AND column_name='tenant_id' AND data_type <> 'uuid'
              ) THEN
                ALTER TABLE public.chat_logs ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
              END IF;
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='chat_logs' AND column_name='created_at' AND data_type='integer'
              ) THEN
                ALTER TABLE public.chat_logs ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at);
              END IF;
            END $$;
            """
        )
    recreate_policies('chat_logs')

    # Connected accounts: drop policies → alter → recreate; tenant_id -> uuid, created_at -> timestamptz
    drop_policies('connected_accounts')
    if conn.dialect.name == 'postgresql':
        run(
            """
            DO $$
            BEGIN
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='connected_accounts' AND column_name='tenant_id' AND data_type <> 'uuid'
              ) THEN
                ALTER TABLE public.connected_accounts ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid;
              END IF;
              IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='connected_accounts' AND column_name='created_at' AND data_type='integer'
              ) THEN
                ALTER TABLE public.connected_accounts ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at);
              END IF;
            END $$;
            """
        )
    recreate_policies('connected_accounts')

    # Generic epoch-to-timestamptz on created_at across other owned tables if present
    for tbl in [
        'audit_logs','dead_letters','idempotency_keys','embeddings','notify_list','share_prompts','consent_logs','curation_decisions'
    ]:
        if conn.dialect.name == 'postgresql':
            run(
                f"""
                DO $$
                BEGIN
                  IF EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='{tbl}' AND column_name='created_at' AND data_type='integer'
                  ) THEN
                    ALTER TABLE public.{tbl} ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at);
                  END IF;
                END $$;
                """
            )


def downgrade() -> None:
    # No downgrade path; alignment is one-way
    pass


