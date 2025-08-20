from alembic import op
import sqlalchemy as sa


revision = '0006_core_state_tables'
down_revision = '0005_settings_table'
branch_labels = None
depends_on = None


def upgrade():
    # lead_status
    op.create_table(
        'lead_status',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True, nullable=False),
        sa.Column('contact_id', sa.String(64), index=True, nullable=False),
        sa.Column('bucket', sa.Integer, nullable=False),
        sa.Column('tag', sa.String(32), nullable=True),
        sa.Column('next_action_at', sa.Integer, nullable=True),
        sa.Column('updated_at', sa.Integer, nullable=True),
    )

    # appointments
    op.create_table(
        'appointments',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True, nullable=False),
        sa.Column('contact_id', sa.String(64), index=True, nullable=False),
        sa.Column('service', sa.String(64), nullable=True),
        sa.Column('start_ts', sa.Integer, nullable=False),
        sa.Column('end_ts', sa.Integer, nullable=True),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('external_ref', sa.String(128), nullable=True),
    )

    # messages ledger (canonical per message)
    op.create_table(
        'messages',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True, nullable=False),
        sa.Column('contact_id', sa.String(64), index=True, nullable=False),
        sa.Column('channel', sa.String(16), nullable=False),
        sa.Column('direction', sa.String(16), nullable=False),
        sa.Column('template_id', sa.String(64), nullable=True),
        sa.Column('body_redacted', sa.Text(), nullable=True),
        sa.Column('status', sa.String(16), nullable=False),
        sa.Column('metadata', sa.Text(), nullable=True),
        sa.Column('ts', sa.Integer, nullable=False),
    )

    # events_ledger (json payload)
    op.create_table(
        'events_ledger',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('ts', sa.Integer, nullable=False),
        sa.Column('tenant_id', sa.String(64), index=True, nullable=False),
        sa.Column('name', sa.String(64), nullable=False),
        sa.Column('payload', sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_table('events_ledger')
    op.drop_table('messages')
    op.drop_table('appointments')
    op.drop_table('lead_status')


