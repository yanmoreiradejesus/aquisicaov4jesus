ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS nome_produto TEXT,
  ADD COLUMN IF NOT EXISTS valor_pago NUMERIC,
  ADD COLUMN IF NOT EXISTS arrematador TEXT,
  ADD COLUMN IF NOT EXISTS data_aquisicao DATE,
  ADD COLUMN IF NOT EXISTS data_criacao_origem TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS faturamento TEXT,
  ADD COLUMN IF NOT EXISTS segmento TEXT,
  ADD COLUMN IF NOT EXISTS canal TEXT,
  ADD COLUMN IF NOT EXISTS pais TEXT,
  ADD COLUMN IF NOT EXISTS documento_empresa TEXT,
  ADD COLUMN IF NOT EXISTS tipo_produto TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS cidade TEXT,
  ADD COLUMN IF NOT EXISTS estado TEXT;

-- Índice único parcial: dedupe por email + data de criação na origem
CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_dedupe_idx
  ON public.crm_leads (lower(email), data_criacao_origem)
  WHERE email IS NOT NULL AND data_criacao_origem IS NOT NULL;