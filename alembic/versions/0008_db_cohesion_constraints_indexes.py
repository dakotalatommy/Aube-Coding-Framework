"""
DB cohesion: add created_at columns, unique constraints, and indexes

Revision ID: 0008_db_cohesion
Revises: 0007_metrics_marts_shells
Create Date: 2025-08-15
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0008_db_cohesion'
down_revision = '0007_metrics_marts_shells'
branch_labels = None
depends_on = None


def _add_created_at(table: str):
    try:
        op.add_column(table, sa.Column('created_at', sa.Integer(), nullable=True))
    except Exception:
        pass


def upgrade():
    # created_at additions
    for t in [
        'contacts','cadence_states','metrics','consent_logs','notify_list','share_prompts','audit_logs',
        'dead_letters','approvals','embeddings','idempotency_keys','settings','lead_status','appointments',
        'messages','events_ledger'
    ]:
        _add_created_at(t)

    # uniqueness constraints
    try:
        op.create_unique_constraint('uq_metrics_tenant', 'metrics', ['tenant_id'])
    except Exception:
        pass
    try:
        op.create_unique_constraint('uq_lead_status_tenant_contact', 'lead_status', ['tenant_id','contact_id'])
    except Exception:
        pass
    try:
        op.create_unique_constraint('uq_cadence_states_tenant_contact', 'cadence_states', ['tenant_id','contact_id'])
    except Exception:
        pass

    # indexes for performance
    try:
        op.create_index('ix_messages_tenant_ts', 'messages', ['tenant_id','ts'])
    except Exception:
        pass
    try:
        op.create_index('ix_messages_tenant_contact_ts', 'messages', ['tenant_id','contact_id','ts'])
    except Exception:
        pass
    try:
        op.create_index('ix_appointments_tenant_start', 'appointments', ['tenant_id','start_ts'])
    except Exception:
        pass
    try:
        op.create_index('ix_appointments_tenant_ext', 'appointments', ['tenant_id','external_ref'])
    except Exception:
        pass
    try:
        op.create_index('ix_events_ledger_tenant_ts', 'events_ledger', ['tenant_id','ts'])
    except Exception:
        pass
    try:
        op.create_index('ix_events_ledger_tenant_name_ts', 'events_ledger', ['tenant_id','name','ts'])
    except Exception:
        pass


def downgrade():
    # best-effort rollback
    for ix in [
        'ix_events_ledger_tenant_name_ts','ix_events_ledger_tenant_ts','ix_appointments_tenant_ext',
        'ix_appointments_tenant_start','ix_messages_tenant_contact_ts','ix_messages_tenant_ts'
    ]:
        try:
            op.drop_index(ix)
        except Exception:
            pass
    for uq, table in [
        ('uq_cadence_states_tenant_contact','cadence_states'),
        ('uq_lead_status_tenant_contact','lead_status'),
        ('uq_metrics_tenant','metrics')
    ]:
        try:
            op.drop_constraint(uq, table_name=table, type_='unique')
        except Exception:
            pass
    for t in [
        'events_ledger','messages','appointments','lead_status','settings','idempotency_keys','embeddings',
        'approvals','dead_letters','audit_logs','share_prompts','notify_list','consent_logs','metrics',
        'cadence_states','contacts'
    ]:
        try:
            op.drop_column(t, 'created_at')
        except Exception:
            pass


