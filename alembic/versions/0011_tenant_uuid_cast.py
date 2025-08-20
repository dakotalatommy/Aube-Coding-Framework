"""
convert tenant_id columns to uuid (Postgres only)

Revision ID: 0011_tenant_uuid_cast
Revises: 0010_add_inbox_messages
Create Date: 2025-08-20
"""

from alembic import op
import sqlalchemy as sa

revision = '0011_tenant_uuid_cast'
down_revision = '0010_add_inbox_messages'
branch_labels = None
depends_on = None


TENANT_TABLES = [
    'contacts','cadence_states','messages','appointments','settings','approvals','dead_letters','idempotency_keys',
    'inventory_items','inventory_summary','calendar_events','connected_accounts','consent_logs','lead_status','chat_logs',
    'events_ledger','inbox_messages','metrics','share_prompts','notify_list','audit_logs','embeddings'
]


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect != 'postgresql':
        # No-op for SQLite and others
        return
    for t in TENANT_TABLES:
        # Perform per-table guarded migration to avoid aborting the whole transaction
        sql = f'''
        DO $$
        BEGIN
            BEGIN
                EXECUTE 'ALTER TABLE ' || quote_ident('{t}') || ' ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid';
            EXCEPTION WHEN others THEN
                -- Swallow errors (table/column may not exist or already migrated)
                NULL;
            END;
        END $$;
        '''
        op.execute(sa.text(sql))


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name
    if dialect != 'postgresql':
        return
    for t in TENANT_TABLES:
        try:
            op.execute(sa.text(f"ALTER TABLE {t} ALTER COLUMN tenant_id TYPE varchar(64) USING tenant_id::text"))
        except Exception:
            pass


