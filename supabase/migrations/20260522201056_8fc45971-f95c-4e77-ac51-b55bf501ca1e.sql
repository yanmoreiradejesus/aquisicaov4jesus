-- Backfill: corrigir tenant_id de eventos de chamada gravados no tenant errado.
-- Para cada evento cujo operador tem voip_account, alinhar tenant_id ao do voip_account.
UPDATE public.crm_call_events e
SET tenant_id = va.tenant_id,
    user_id = COALESCE(e.user_id, va.user_id)
FROM public.voip_accounts va
WHERE va.provider = e.provider
  AND va.operador_id = e.operador
  AND va.ativo = true
  AND e.operador IS NOT NULL
  AND e.tenant_id IS DISTINCT FROM va.tenant_id;

-- Religar lead_id de eventos cujo lead atual está em tenant diferente do evento
-- (ou que ficaram sem lead): tenta achar lead com mesmo telefone no tenant correto.
UPDATE public.crm_call_events e
SET lead_id = l.id
FROM public.crm_leads l
WHERE e.tenant_id = l.tenant_id
  AND e.telefone_normalizado IS NOT NULL
  AND length(e.telefone_normalizado) >= 10
  AND right(regexp_replace(l.telefone, '\D', '', 'g'), 10) = right(e.telefone_normalizado, 10)
  AND (
    e.lead_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.crm_leads l2
      WHERE l2.id = e.lead_id AND l2.tenant_id = e.tenant_id
    )
  );