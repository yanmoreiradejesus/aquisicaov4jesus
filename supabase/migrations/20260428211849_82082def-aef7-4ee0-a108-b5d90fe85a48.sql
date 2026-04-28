-- Enum para status de onboarding
DO $$ BEGIN
  CREATE TYPE public.onboarding_status AS ENUM ('entrada', 'atrasada', 'concluida', 'churn_m0');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Adiciona colunas na tabela accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS onboarding_status public.onboarding_status NOT NULL DEFAULT 'entrada',
  ADD COLUMN IF NOT EXISTS growth_class_data_agendada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS growth_class_data_realizada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS growth_class_responsavel_id UUID,
  ADD COLUMN IF NOT EXISTS growth_class_meet_link TEXT,
  ADD COLUMN IF NOT EXISTS growth_class_ata TEXT,
  ADD COLUMN IF NOT EXISTS growth_class_expectativas TEXT,
  ADD COLUMN IF NOT EXISTS growth_class_proximos_passos TEXT,
  ADD COLUMN IF NOT EXISTS growth_class_oportunidades_monetizacao TEXT,
  ADD COLUMN IF NOT EXISTS growth_class_google_event_id TEXT;

-- Trigger updated_at já existe na tabela? garantir
CREATE OR REPLACE TRIGGER accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índice para filtros por status
CREATE INDEX IF NOT EXISTS idx_accounts_onboarding_status ON public.accounts(onboarding_status);
CREATE INDEX IF NOT EXISTS idx_accounts_growth_class_agendada ON public.accounts(growth_class_data_agendada);