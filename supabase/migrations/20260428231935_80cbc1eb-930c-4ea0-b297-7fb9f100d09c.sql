ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS pre_growth_class_relatorio TEXT,
  ADD COLUMN IF NOT EXISTS pre_growth_class_gerado_em TIMESTAMPTZ;