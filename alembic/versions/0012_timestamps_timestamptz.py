"""
convert created_at integer to timestamptz for core tables (Postgres only)

Revision ID: 0012_timestamps_timestamptz
Revises: 0011_tenant_uuid_cast
Create Date: 2025-08-20
"""

from alembic import op
import sqlalchemy as sa

revision = '0012_timestamps_timestamptz'
down_revision = '0011_tenant_uuid_cast'
branch_labels = None
depends_on = None


TS_TABLES = [
    'contacts','cadence_states','messages','appointments','settings','approvals','dead_letters','idempotency_keys',
    'inventory_items','inventory_summary','calendar_events','connected_accounts','consent_logs','lead_status','chat_logs',
    'events_ledger','inbox_messages','metrics'
]


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    for t in TS_TABLES:
        sql = f'''
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = '{t}' AND column_name = 'created_at'
            ) THEN
                BEGIN
                    EXECUTE 'ALTER TABLE ' || quote_ident('{t}') || ' ALTER COLUMN created_at TYPE timestamptz USING to_timestamp(created_at)';
                EXCEPTION WHEN others THEN
                    NULL;
                END;
            END IF;
        END $$;
        '''
        op.execute(sa.text(sql))


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        return
    for t in TS_TABLES:
        sql = f'''
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = '{t}' AND column_name = 'created_at'
            ) THEN
                BEGIN
                    EXECUTE 'ALTER TABLE ' || quote_ident('{t}') || ' ALTER COLUMN created_at TYPE integer USING EXTRACT(EPOCH FROM created_at)::int';
                EXCEPTION WHEN others THEN
                    NULL;
                END;
            END IF;
        END $$;
        '''
        op.execute(sa.text(sql))


