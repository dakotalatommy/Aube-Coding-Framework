-- Add unique constraint for ON CONFLICT clause to work
-- This enables idempotent transaction inserts using (tenant_id, external_ref)

-- First, remove any duplicate rows if they exist
-- (Keep the oldest record for each duplicate)
DELETE FROM public.transactions a
USING public.transactions b
WHERE a.id > b.id 
  AND a.tenant_id = b.tenant_id 
  AND a.external_ref = b.external_ref
  AND a.external_ref IS NOT NULL;

-- Now add the unique constraint
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_tenant_external_ref_unique 
UNIQUE (tenant_id, external_ref);

-- Add comment
COMMENT ON CONSTRAINT transactions_tenant_external_ref_unique ON public.transactions 
IS 'Ensures idempotent transaction inserts - one transaction per external reference per tenant';

