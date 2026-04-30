-- Enum para o tipo de pipe do lead
DO $$ BEGIN
  CREATE TYPE public.lead_pipe AS ENUM ('inbound', 'outbound');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Coluna pipe em crm_leads (default inbound, todos os leads atuais viram inbound)
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS pipe public.lead_pipe NOT NULL DEFAULT 'inbound';

-- Índice para filtrar rápido por pipe
CREATE INDEX IF NOT EXISTS idx_crm_leads_pipe ON public.crm_leads(pipe);