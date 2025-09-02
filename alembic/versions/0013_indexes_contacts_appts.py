"""
add useful indexes: contacts names, appointments start_ts

Revision ID: 0013_indexes_contacts_appts
Revises: 0012_timestamps_timestamptz
Create Date: 2025-08-21
"""

from alembic import op
import sqlalchemy as sa

revision = '0013_indexes_contacts_appts'
down_revision = '0012_timestamps_timestamptz'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    # Contacts display_name, first_name/last_name
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts(display_name)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_contacts_first_last ON contacts((lower(coalesce(first_name,''))),(lower(coalesce(last_name,''))))"))
    # Appointments: by (contact_id, start_ts) and by start_ts for ranges
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_appts_contact_start ON appointments(contact_id, start_ts)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS idx_appts_start ON appointments(start_ts)"))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    op.execute(sa.text("DROP INDEX IF EXISTS idx_contacts_display_name"))
    op.execute(sa.text("DROP INDEX IF EXISTS idx_contacts_first_last"))
    op.execute(sa.text("DROP INDEX IF EXISTS idx_appts_contact_start"))
    op.execute(sa.text("DROP INDEX IF EXISTS idx_appts_start"))


