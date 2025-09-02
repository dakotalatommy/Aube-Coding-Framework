"""
create usage_limits and share_reports tables if missing (Postgres)

Revision ID: 0014_usage_limits_and_share_reports
Revises: 0013_indexes_contacts_appts
Create Date: 2025-08-22
"""

from alembic import op
import sqlalchemy as sa

revision = '0014_usage_limits_and_share_reports'
down_revision = '0013_indexes_contacts_appts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    # usage_limits (matches models.Plan/UsageLimit usage)
    op.execute(sa.text(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='usage_limits') THEN
            CREATE TABLE usage_limits (
              id BIGSERIAL PRIMARY KEY,
              tenant_id UUID UNIQUE NOT NULL,
              plan_code TEXT,
              active BOOLEAN DEFAULT TRUE,
              ai_daily_cents_cap INTEGER,
              ai_monthly_cents_cap INTEGER,
              messages_daily_cap INTEGER,
              grace_until INTEGER,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_usage_limits_tenant ON usage_limits(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_usage_limits_plan ON usage_limits(plan_code);
          END IF;
        END $$;
        """
    ))
    # share_reports used by report downloads
    op.execute(sa.text(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='share_reports') THEN
            CREATE TABLE share_reports (
              id BIGSERIAL PRIMARY KEY,
              tenant_id UUID NOT NULL,
              token TEXT NOT NULL,
              mime TEXT NOT NULL,
              filename TEXT NOT NULL,
              data_text TEXT NOT NULL,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_share_reports_token ON share_reports(token);
          END IF;
        END $$;
        """
    ))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    op.execute(sa.text("DROP TABLE IF EXISTS share_reports"))
    op.execute(sa.text("DROP TABLE IF EXISTS usage_limits"))


