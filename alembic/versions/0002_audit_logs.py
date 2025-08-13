from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table('audit_logs',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('tenant_id', sa.String(64), index=True),
        sa.Column('actor_id', sa.String(64)),
        sa.Column('action', sa.String(64)),
        sa.Column('entity_ref', sa.String(128)),
        sa.Column('payload', sa.Text()),
    )


def downgrade():
    op.drop_table('audit_logs')
