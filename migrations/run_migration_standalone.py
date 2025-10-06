#!/usr/bin/env python3
"""
Standalone migration runner for transactions table.
Uses environment variables for database connection.
"""
import os
import psycopg2

# Database connection from environment or hardcoded Supabase connection
DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres.dwfvnqajrwruprqbjxph:Aube2024!!@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
)

migration_sql = """
-- Create transactions table for payment tracking
CREATE TABLE IF NOT EXISTS public.transactions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  contact_id TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  external_ref TEXT,
  metadata JSONB,
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

-- Drop existing policy if it exists
DROP POLICY IF EXISTS transactions_tenant_isolation ON public.transactions;

-- RLS Policy: Tenants can only see their own transactions
CREATE POLICY transactions_tenant_isolation ON public.transactions
  FOR ALL
  USING (tenant_id = COALESCE(current_setting('app.tenant_id', true)::uuid, '00000000-0000-0000-0000-000000000000'::uuid));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE transactions_id_seq TO authenticated;

-- Add comment
COMMENT ON TABLE public.transactions IS 'Payment transactions for revenue tracking and monthly analytics';
"""

print("🔄 Connecting to Supabase database...")
print("=" * 60)

try:
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("✅ Connected successfully!")
    print("\n🔄 Running transactions table migration...")
    
    cursor.execute(migration_sql)
    
    print("✅ Migration completed successfully!")
    print("\nCreated:")
    print("  - transactions table")
    print("  - 4 indexes for performance")
    print("  - RLS policy for tenant isolation")
    print("  - Permissions for authenticated users")
    
    # Verify the table exists
    cursor.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
    """)
    
    columns = cursor.fetchall()
    if columns:
        print("\n📋 Table structure verified:")
        for col_name, data_type in columns:
            print(f"  - {col_name}: {data_type}")
    
    cursor.close()
    conn.close()
    print("\n✅ Migration complete! Ready to sync payments.")
    
except Exception as e:
    print(f"❌ Migration failed: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

