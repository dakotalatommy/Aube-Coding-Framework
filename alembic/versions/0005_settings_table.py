from alembic import op
import sqlalchemy as sa


revision = '0005_settings_table'
down_revision = '0004_idempotency_keys'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'settings',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True),
        sa.Column('data_json', sa.Text(), nullable=False, server_default='{}'),
    )


def downgrade():
    op.drop_table('settings')


