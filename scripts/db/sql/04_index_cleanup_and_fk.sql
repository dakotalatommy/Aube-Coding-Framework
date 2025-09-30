-- 04_index_cleanup_and_fk.sql
-- Drops redundant tenant indexes and adds missing FK-covering indexes.
-- Review the DROP statements before execution; comment out any you wish to keep.

SET statement_timeout = '30s';
SET lock_timeout = '5s';

-- Duplicate tenant indexes (DROP only if not required by constraints)
DROP INDEX IF EXISTS public.ai_memories_tenant_idx;
DROP INDEX IF EXISTS public.idx_appt_tenant;
DROP INDEX IF EXISTS public.appointments_tenant_idx;
DROP INDEX IF EXISTS public.idx_approvals_tenant;
DROP INDEX IF EXISTS public.ix_approvals_tenant_id;
DROP INDEX IF EXISTS public.idx_audit_tenant;
DROP INDEX IF EXISTS public.ix_cadence_states_tenant_id;
DROP INDEX IF EXISTS public.idx_cal_events_tenant;
DROP INDEX IF EXISTS public.idx_chat_tenant;
DROP INDEX IF EXISTS public.ix_chat_logs_tenant_id;
DROP INDEX IF EXISTS public.connected_accounts_tenant_idx;
DROP INDEX IF EXISTS public.idx_consent_tenant;
DROP INDEX IF EXISTS public.ix_consent_logs_tenant_id;
DROP INDEX IF EXISTS public.contacts_tenant_idx;
DROP INDEX IF EXISTS public.idx_curation_tenant;
DROP INDEX IF EXISTS public.ix_curation_decisions_tenant_id;
DROP INDEX IF EXISTS public.idx_dead_tenant;
DROP INDEX IF EXISTS public.ix_dead_letters_tenant_id;
DROP INDEX IF EXISTS public.idx_embeddings_tenant;
DROP INDEX IF EXISTS public.ix_embeddings_tenant_id;
DROP INDEX IF EXISTS public.idx_events_tenant;
DROP INDEX IF EXISTS public.ix_events_ledger_tenant_id;
DROP INDEX IF EXISTS public.idx_idem_tenant;
DROP INDEX IF EXISTS public.ix_idempotency_keys_tenant_id;
DROP INDEX IF EXISTS public.idx_inbox_tenant;
DROP INDEX IF EXISTS public.ix_inbox_messages_tenant_id;
DROP INDEX IF EXISTS public.idx_invitems_tenant;
DROP INDEX IF EXISTS public.idx_lead_tenant;
DROP INDEX IF EXISTS public.lead_status_tenant_idx;
DROP INDEX IF EXISTS public.idx_msg_tenant;
DROP INDEX IF EXISTS public.messages_tenant_idx;
DROP INDEX IF EXISTS public.idx_metrics_tenant;
DROP INDEX IF EXISTS public.ix_metrics_tenant_id;
DROP INDEX IF EXISTS public.idx_notify_tenant;
DROP INDEX IF EXISTS public.ix_notify_list_tenant_id;
DROP INDEX IF EXISTS public.ix_settings_tenant_id;
DROP INDEX IF EXISTS public.idx_share_prompts_tenant;
DROP INDEX IF EXISTS public.ix_share_prompts_tenant_id;
DROP INDEX IF EXISTS public.idx_usage_limits_tenant;

-- Foreign key covering indexes
CREATE INDEX IF NOT EXISTS cadence_rules_template_id_idx ON public.cadence_rules(template_id);
CREATE INDEX IF NOT EXISTS messages_contact_id_idx ON public.messages(contact_id);
CREATE INDEX IF NOT EXISTS profiles_tenant_id_idx ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS referrals_ref_code_idx ON public.referrals(ref_code);
CREATE INDEX IF NOT EXISTS referrals_referrer_user_id_idx ON public.referrals(referrer_user_id);
