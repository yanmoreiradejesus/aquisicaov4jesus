
-- Trigger: ao mover lead para etapa 'reuniao_realizada', carimba data_reuniao_realizada = now()
CREATE OR REPLACE FUNCTION public.set_data_reuniao_realizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.etapa = 'reuniao_realizada'::lead_etapa
     AND (OLD.etapa IS DISTINCT FROM NEW.etapa) THEN
    NEW.data_reuniao_realizada := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_data_reuniao_realizada ON public.crm_leads;
CREATE TRIGGER trg_set_data_reuniao_realizada
BEFORE UPDATE OF etapa ON public.crm_leads
FOR EACH ROW
EXECUTE FUNCTION public.set_data_reuniao_realizada();

-- Backfill: leads que já estão em etapas pós-reunião sem data preenchida,
-- usa a data do evento de mudança de etapa mais recente para 'reuniao_realizada'.
WITH eventos AS (
  SELECT DISTINCT ON (lead_id)
    lead_id,
    created_at AS quando
  FROM public.crm_atividades
  WHERE tipo = 'mudanca_etapa'
    AND descricao LIKE '%para "reuniao_realizada"%'
  ORDER BY lead_id, created_at DESC
)
UPDATE public.crm_leads l
SET data_reuniao_realizada = e.quando
FROM eventos e
WHERE l.id = e.lead_id
  AND l.data_reuniao_realizada IS NULL;

-- Fallback: leads atualmente em 'reuniao_realizada' sem evento registrado, usa updated_at
UPDATE public.crm_leads
SET data_reuniao_realizada = updated_at
WHERE etapa = 'reuniao_realizada'
  AND data_reuniao_realizada IS NULL;
