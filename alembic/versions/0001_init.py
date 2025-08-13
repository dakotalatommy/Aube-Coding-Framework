from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table('contacts',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True),
        sa.Column('contact_id', sa.String(64), index=True),
        sa.Column('email_hash', sa.String(128)),
        sa.Column('phone_hash', sa.String(128)),
        sa.Column('consent_sms', sa.Boolean, server_default=sa.text('0')),
        sa.Column('consent_email', sa.Boolean, server_default=sa.text('0')),
    )
    op.create_table('cadence_states',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True),
        sa.Column('contact_id', sa.String(64), index=True),
        sa.Column('cadence_id', sa.String(64)),
        sa.Column('step_index', sa.Integer, server_default='0'),
    )
    op.create_table('metrics',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True),
        sa.Column('time_saved_minutes', sa.Integer, server_default='0'),
        sa.Column('messages_sent', sa.Integer, server_default='0'),
    )
    op.create_table('consent_logs',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True),
        sa.Column('contact_id', sa.String(64), index=True),
        sa.Column('channel', sa.String(16)),
        sa.Column('consent', sa.String(16)),
        sa.Column('reason', sa.String(128)),
    )
    op.create_table('notify_list',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True),
        sa.Column('contact_id', sa.String(64), index=True),
        sa.Column('preference', sa.String(16)),
    )
    op.create_table('share_prompts',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True),
        sa.Column('kind', sa.String(64)),
        sa.Column('surfaced', sa.Boolean, server_default=sa.text('0')),
    )

def downgrade():
    op.drop_table('share_prompts')
    op.drop_table('notify_list')
    op.drop_table('consent_logs')
    op.drop_table('metrics')
    op.drop_table('cadence_states')
    op.drop_table('contacts')
