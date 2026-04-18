-- Add 'tarefa' to atividade_tipo enum
ALTER TYPE public.atividade_tipo ADD VALUE IF NOT EXISTS 'tarefa';
ALTER TYPE public.atividade_tipo ADD VALUE IF NOT EXISTS 'mudanca_etapa';
ALTER TYPE public.atividade_tipo ADD VALUE IF NOT EXISTS 'criacao';

-- Add task fields to crm_atividades
ALTER TABLE public.crm_atividades
  ADD COLUMN IF NOT EXISTS data_agendada TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS concluida BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS data_conclusao TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS titulo TEXT;

-- Allow update on crm_atividades (for completing tasks)
DROP POLICY IF EXISTS "Author or admin update atividades" ON public.crm_atividades;
CREATE POLICY "Author or admin update atividades"
ON public.crm_atividades
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR (usuario_id = auth.uid()));

-- Trigger: log stage changes
CREATE OR REPLACE FUNCTION public.log_lead_etapa_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.crm_atividades (lead_id, tipo, descricao, usuario_id)
    VALUES (
      NEW.id,
      'mudanca_etapa',
      'Etapa alterada de "' || OLD.etapa::text || '" para "' || NEW.etapa::text || '"',
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_etapa_change ON public.crm_leads;
CREATE TRIGGER trg_log_lead_etapa_change
AFTER UPDATE ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_etapa_change();

-- Trigger: log lead creation
CREATE OR REPLACE FUNCTION public.log_lead_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_atividades (lead_id, tipo, descricao, usuario_id)
  VALUES (
    NEW.id,
    'criacao',
    'Lead cadastrado no sistema',
    NEW.created_by
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_creation ON public.crm_leads;
CREATE TRIGGER trg_log_lead_creation
AFTER INSERT ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.log_lead_creation();

-- Index for fast timeline lookup
CREATE INDEX IF NOT EXISTS idx_crm_atividades_lead_created
ON public.crm_atividades (lead_id, created_at DESC);