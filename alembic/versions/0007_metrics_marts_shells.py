from alembic import op
import sqlalchemy as sa


revision = '0007_metrics_marts_shells'
down_revision = '0006_core_state_tables'
branch_labels = None
depends_on = None


def upgrade():
    # funnel_daily (shell)
    op.create_table(
        'funnel_daily',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True, nullable=False),
        sa.Column('day', sa.String(10), index=True, nullable=False),
        sa.Column('impressions', sa.Integer, server_default='0'),
        sa.Column('waitlist', sa.Integer, server_default='0'),
        sa.Column('demo', sa.Integer, server_default='0'),
        sa.Column('trial', sa.Integer, server_default='0'),
        sa.Column('paid', sa.Integer, server_default='0'),
        sa.Column('retained', sa.Integer, server_default='0'),
    )

    # cadence_performance (shell)
    op.create_table(
        'cadence_performance',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True, nullable=False),
        sa.Column('cadence_id', sa.String(64), nullable=False),
        sa.Column('step_index', sa.Integer, nullable=False),
        sa.Column('sent', sa.Integer, server_default='0'),
        sa.Column('replied', sa.Integer, server_default='0'),
        sa.Column('converted', sa.Integer, server_default='0'),
    )

    # time_saved_rollup (shell)
    op.create_table(
        'time_saved_rollup',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True, nullable=False),
        sa.Column('period', sa.String(16), nullable=False),
        sa.Column('minutes_saved', sa.Integer, server_default='0'),
    )

    # revenue_snapshot (shell)
    op.create_table(
        'revenue_snapshot',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True, nullable=False),
        sa.Column('period', sa.String(16), nullable=False),
        sa.Column('amount_cents', sa.Integer, server_default='0'),
    )


def downgrade():
    op.drop_table('revenue_snapshot')
    op.drop_table('time_saved_rollup')
    op.drop_table('cadence_performance')
    op.drop_table('funnel_daily')


