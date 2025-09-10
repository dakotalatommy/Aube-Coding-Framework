from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0016_align_lead_status_next_action_and_indexes'
down_revision = '0015_acuity_and_client_images'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Ensure pgcrypto for gen_random_uuid if not present
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    # Align lead_status.next_action_at to timestamptz
    op.execute(
        """
        DO $$
        DECLARE
          col_type text;
        BEGIN
          SELECT data_type
          INTO col_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'lead_status'
            AND column_name = 'next_action_at';

          IF col_type IS NULL THEN
            ALTER TABLE public.lead_status
              ADD COLUMN next_action_at timestamptz;
          ELSIF col_type IN ('bigint','integer','numeric','double precision') THEN
            ALTER TABLE public.lead_status
              ALTER COLUMN next_action_at TYPE timestamptz
              USING to_timestamp(next_action_at::double precision);
          ELSIF col_type NOT IN ('timestamp with time zone','timestamp without time zone') THEN
            ALTER TABLE public.lead_status
              ALTER COLUMN next_action_at TYPE timestamptz
              USING (next_action_at::timestamptz);
          END IF;
        END $$;
        """
    )

    # Helpful composite indexes
    op.execute("CREATE INDEX IF NOT EXISTS lead_status_tenant_next_idx ON public.lead_status (tenant_id, next_action_at)")
    op.execute("CREATE INDEX IF NOT EXISTS appointments_tenant_status_start_idx ON public.appointments (tenant_id, status, start_ts)")
    op.execute("CREATE INDEX IF NOT EXISTS contacts_tenant_ltv_lastvisit_idx ON public.contacts (tenant_id, lifetime_cents DESC, last_visit)")


def downgrade() -> None:
    # Downgrade leaves column type as-is (non-destructive). Drop created indexes.
    op.execute("DROP INDEX IF EXISTS public.lead_status_tenant_next_idx")
    op.execute("DROP INDEX IF EXISTS public.appointments_tenant_status_start_idx")
    op.execute("DROP INDEX IF EXISTS public.contacts_tenant_ltv_lastvisit_idx")
