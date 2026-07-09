ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS growth_class_expectativas_revisado TEXT,
  ADD COLUMN IF NOT EXISTS growth_class_expectativas_revisado_em TIMESTAMPTZ;