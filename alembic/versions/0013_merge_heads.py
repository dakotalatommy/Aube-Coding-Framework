"""merge 0012 heads

Revision ID: 0013_merge_heads
Revises: 0012_share_links_and_persistence, 0012_timestamps_timestamptz
Create Date: 2025-08-20 00:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = '0013_merge_heads'
down_revision = ('0012_share_links_and_persistence', '0012_timestamps_timestamptz')
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No-op merge
    pass


def downgrade() -> None:
    # No-op merge
    pass


