-- Create transactions table for payment tracking
-- This enables accurate monthly revenue and uplift calculations

CREATE TABLE IF NOT EXISTS public.transactions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  contact_id TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,  -- 'square', 'acuity', 'manual'
  external_ref TEXT,     -- Square order ID, Acuity appointment ID, etc.
  metadata JSONB,        -- Additional data (service type, location, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_contact_id ON public.transactions(tenant_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(tenant_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_external_ref ON public.transactions(source, external_ref);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenants can only see their own transactions
CREATE POLICY transactions_tenant_isolation ON public.transactions
  FOR ALL
  USING (tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE transactions_id_seq TO authenticated;

-- Add comment
COMMENT ON TABLE public.transactions IS 'Payment transactions for revenue tracking and monthly analytics';

