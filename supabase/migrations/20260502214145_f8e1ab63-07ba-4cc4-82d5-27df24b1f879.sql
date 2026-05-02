ALTER TABLE public.accounts
ADD COLUMN IF NOT EXISTS contract_validation jsonb,
ADD COLUMN IF NOT EXISTS contract_validation_at timestamptz,
ADD COLUMN IF NOT EXISTS contract_validation_url text;