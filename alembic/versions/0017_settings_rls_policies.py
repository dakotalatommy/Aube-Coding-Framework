from alembic import op

# revision identifiers, used by Alembic.
revision = '0017_settings_rls_policies'
down_revision = '0016_align_lead_status_next_action_and_indexes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        -- Enable RLS on settings and add tenant policies
        ALTER TABLE IF EXISTS public.settings ENABLE ROW LEVEL SECURITY;
        CREATE POLICY IF NOT EXISTS settings_tenant_select ON public.settings
          FOR SELECT USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));
        CREATE POLICY IF NOT EXISTS settings_tenant_mod ON public.settings
          FOR INSERT WITH CHECK (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));
        CREATE POLICY IF NOT EXISTS settings_tenant_update ON public.settings
          FOR UPDATE USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid))
                          WITH CHECK (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));
        """
    )


def downgrade() -> None:
    # Keep RLS enabled; remove policies if present
    op.execute(
        """
        DROP POLICY IF EXISTS settings_tenant_update ON public.settings;
        DROP POLICY IF EXISTS settings_tenant_mod ON public.settings;
        DROP POLICY IF EXISTS settings_tenant_select ON public.settings;
        """
    )


