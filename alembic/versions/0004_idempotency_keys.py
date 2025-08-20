"""add idempotency_keys table

Revision ID: 0004_idempotency_keys
Revises: 0003_scheduler_deadletter_softdelete
Create Date: 2025-08-13 00:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0004_idempotency_keys'
down_revision = '0003_scheduler_deadletter_softdelete'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'idempotency_keys',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(length=64), nullable=False, index=True),
        sa.Column('key', sa.String(length=128), nullable=False, unique=True, index=True),
    )


def downgrade() -> None:
    op.drop_table('idempotency_keys')


