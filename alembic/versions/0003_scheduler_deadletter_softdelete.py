from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('contacts', sa.Column('deleted', sa.Boolean, server_default=sa.text('0')))
    op.add_column('cadence_states', sa.Column('next_action_epoch', sa.Integer))
    op.create_table('dead_letters',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True),
        sa.Column('provider', sa.String(64)),
        sa.Column('reason', sa.String(128)),
        sa.Column('attempts', sa.Integer, server_default='0'),
        sa.Column('payload', sa.Text()),
    )


def downgrade():
    op.drop_table('dead_letters')
    op.drop_column('cadence_states', 'next_action_epoch')
    op.drop_column('contacts', 'deleted')
