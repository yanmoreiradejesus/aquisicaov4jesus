ALTER TABLE public.crm_projetos
  ADD COLUMN IF NOT EXISTS growth_class_ia_relatorio TEXT,
  ADD COLUMN IF NOT EXISTS growth_class_ia_gerado_em TIMESTAMPTZ;