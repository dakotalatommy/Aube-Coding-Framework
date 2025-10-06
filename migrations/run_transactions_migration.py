#!/usr/bin/env python3
"""
Run the transactions table migration directly against Supabase.
This script connects using the service role key to bypass RLS.
"""
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from app.db import engine
from sqlalchemy import text

def run_migration():
    """Execute the transactions table migration."""
    
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

    print("🔄 Running transactions table migration...")
    print("=" * 60)
    
    try:
        with engine.begin() as conn:
            # Execute the migration
            conn.execute(text(migration_sql))
            
        print("✅ Migration completed successfully!")
        print("\nCreated:")
        print("  - transactions table")
        print("  - 4 indexes for performance")
        print("  - RLS policy for tenant isolation")
        print("  - Permissions for authenticated users")
        
        # Verify the table exists
        with engine.begin() as conn:
            result = conn.execute(text("""
                SELECT table_name, column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'transactions' 
                AND table_schema = 'public'
                ORDER BY ordinal_position
            """)).fetchall()
            
            if result:
                print("\n📋 Table structure verified:")
                for row in result:
                    print(f"  - {row[1]}: {row[2]}")
            else:
                print("\n⚠️  Warning: Could not verify table structure")
                
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_migration()

