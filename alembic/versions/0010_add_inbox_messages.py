"""
add inbox_messages table

Revision ID: 0010_add_inbox_messages
Revises: 0009_supabase_alignment
Create Date: 2025-08-20
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0010_add_inbox_messages'
down_revision = '0009_supabase_alignment'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'inbox_messages',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(length=64), nullable=False, index=True),
        sa.Column('channel', sa.String(length=32), nullable=False, index=True),
        sa.Column('from_addr', sa.String(length=256), nullable=True),
        sa.Column('to_addr', sa.String(length=256), nullable=True),
        sa.Column('preview', sa.Text(), nullable=True),
        sa.Column('ts', sa.Integer(), nullable=False, index=True),
        sa.Column('created_at', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_table('inbox_messages')



