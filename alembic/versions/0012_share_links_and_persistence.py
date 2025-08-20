"""add share_links and no-op settings JSON persistence keys

Revision ID: 0012_share_links_and_persistence
Revises: 0011_tenant_uuid_cast
Create Date: 2025-08-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0012_share_links_and_persistence'
down_revision = '0011_tenant_uuid_cast'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'share_links',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tenant_id', sa.String(length=64), index=True, nullable=False),
        sa.Column('token', sa.String(length=64), nullable=False, unique=True, index=True),
        sa.Column('title', sa.String(length=256), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_url', sa.String(length=512), nullable=True),
        sa.Column('caption', sa.String(length=512), nullable=True),
        sa.Column('kind', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_table('share_links')


