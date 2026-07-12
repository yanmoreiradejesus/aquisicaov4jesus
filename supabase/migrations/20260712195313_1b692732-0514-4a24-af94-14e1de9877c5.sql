
ALTER TABLE public.crm_expansoes
  ADD COLUMN IF NOT EXISTS contrato_path text,
  ADD COLUMN IF NOT EXISTS novo_fee_mensal numeric;
