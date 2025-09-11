-- BrandVX sweep schema (Supabase Postgres)
-- Run in a transaction; enable RLS; use GUCs for tenant writes where applicable

-- onboarding_progress
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  step_key text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  context_json jsonb NULL
);
CREATE INDEX IF NOT EXISTS onboarding_progress_tenant_step_idx ON onboarding_progress(tenant_id, step_key);
CREATE INDEX IF NOT EXISTS onboarding_progress_tenant_completed_idx ON onboarding_progress(tenant_id, completed_at DESC);
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS onboarding_progress_sel ON onboarding_progress FOR SELECT
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));
CREATE POLICY IF NOT EXISTS onboarding_progress_all ON onboarding_progress FOR ALL
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid))
  WITH CHECK (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));

-- plan_14day
CREATE TABLE IF NOT EXISTS plan_14day (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  day_index int NOT NULL,
  tasks_json jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS plan_14day_tenant_day_uq ON plan_14day(tenant_id, day_index);
ALTER TABLE plan_14day ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS plan_14day_sel ON plan_14day FOR SELECT
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));
CREATE POLICY IF NOT EXISTS plan_14day_all ON plan_14day FOR ALL
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid))
  WITH CHECK (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));

-- referrals
CREATE TABLE IF NOT EXISTS referrals (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  referral_link text,
  uploaded_proof_url text,
  plan_before text,
  plan_after text,
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS referrals_tenant_idx ON referrals(tenant_id);
CREATE INDEX IF NOT EXISTS referrals_processed_idx ON referrals(processed_at);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS referrals_sel ON referrals FOR SELECT
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));
CREATE POLICY IF NOT EXISTS referrals_all ON referrals FOR ALL
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid))
  WITH CHECK (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));

-- chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  session_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz NULL,
  meta_json jsonb NULL
);
CREATE INDEX IF NOT EXISTS chat_sessions_tenant_started_idx ON chat_sessions(tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS chat_sessions_tenant_session_idx ON chat_sessions(tenant_id, session_id);
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS chat_sessions_sel ON chat_sessions FOR SELECT
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));
CREATE POLICY IF NOT EXISTS chat_sessions_all ON chat_sessions FOR ALL
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid))
  WITH CHECK (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));

-- client_action_flags
CREATE TABLE IF NOT EXISTS client_action_flags (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  contact_id text NOT NULL,
  last_followup_epoch bigint NOT NULL DEFAULT 0,
  flags_json jsonb NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS client_action_flags_tenant_contact_uq ON client_action_flags(tenant_id, contact_id);
ALTER TABLE client_action_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS client_action_flags_sel ON client_action_flags FOR SELECT
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));
CREATE POLICY IF NOT EXISTS client_action_flags_all ON client_action_flags FOR ALL
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid))
  WITH CHECK (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));

-- todo_items (optional unified To‑Do store)
CREATE TABLE IF NOT EXISTS todo_items (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  title text NOT NULL,
  details_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS todo_items_tenant_status_idx ON todo_items(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS todo_items_tenant_type_idx ON todo_items(tenant_id, type);
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS todo_items_sel ON todo_items FOR SELECT
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));
CREATE POLICY IF NOT EXISTS todo_items_all ON todo_items FOR ALL
  USING (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid))
  WITH CHECK (tenant_id = CAST(current_setting('app.tenant_id', true) AS uuid));

-- Helpful indexes for existing heavy tables
-- chat_logs
CREATE INDEX IF NOT EXISTS chat_logs_tenant_session_idx ON chat_logs(tenant_id, session_id, id);
CREATE INDEX IF NOT EXISTS chat_logs_tenant_created_idx ON chat_logs(tenant_id, created_at DESC);
-- ai_memories
CREATE INDEX IF NOT EXISTS ai_memories_tenant_updated_idx ON ai_memories(tenant_id, updated_at DESC);
-- appointments/messages
CREATE INDEX IF NOT EXISTS appointments_tenant_start_idx ON appointments(tenant_id, start_ts);
CREATE INDEX IF NOT EXISTS messages_tenant_status_ts_idx ON messages(tenant_id, status, ts DESC);

