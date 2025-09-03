"""
Add appointments.provider/provider_event_id, updated_at; calendar_events unique index; client_images table.

Revision ID: 0015_acuity_and_client_images
Revises: 0014_usage_limits_and_share_reports
Create Date: 2025-09-02
"""

from alembic import op
import sqlalchemy as sa

revision = '0015_acuity_and_client_images'
down_revision = '0014_usage_limits_and_share_reports'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    # appointments: provider fields and updated_at
    op.execute(sa.text(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='appointments' AND column_name='provider'
          ) THEN
            ALTER TABLE appointments ADD COLUMN provider TEXT;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='appointments' AND column_name='provider_event_id'
          ) THEN
            ALTER TABLE appointments ADD COLUMN provider_event_id TEXT;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='appointments' AND column_name='updated_at'
          ) THEN
            ALTER TABLE appointments ADD COLUMN updated_at INTEGER DEFAULT (EXTRACT(EPOCH FROM NOW()))::int;
          END IF;
          CREATE INDEX IF NOT EXISTS idx_appts_tenant_ext ON appointments(tenant_id, external_ref);
          CREATE INDEX IF NOT EXISTS idx_appts_tenant_provider_event ON appointments(tenant_id, provider, provider_event_id);
        END $$;
        """
    ))

    # calendar_events: unique per-tenant event_id to reduce dupes
    op.execute(sa.text(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname='ux_cal_events_tenant_event'
          ) THEN
            CREATE UNIQUE INDEX ux_cal_events_tenant_event ON calendar_events(tenant_id, event_id);
          END IF;
        END $$;
        """
    ))

    # client_images table for per-contact galleries
    op.execute(sa.text(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='client_images') THEN
            CREATE TABLE client_images (
              id BIGSERIAL PRIMARY KEY,
              tenant_id UUID NOT NULL,
              contact_id TEXT NOT NULL,
              kind TEXT,
              url TEXT NOT NULL,
              notes TEXT,
              created_at INTEGER DEFAULT (EXTRACT(EPOCH FROM NOW()))::int
            );
            CREATE INDEX IF NOT EXISTS idx_client_images_tenant ON client_images(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_client_images_contact ON client_images(contact_id);
          END IF;
        END $$;
        """
    ))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    # Best‑effort drops (keep indexes if used elsewhere)
    op.execute(sa.text("DROP TABLE IF EXISTS client_images"))
    # Do not drop columns from appointments to avoid data loss in downgrades



