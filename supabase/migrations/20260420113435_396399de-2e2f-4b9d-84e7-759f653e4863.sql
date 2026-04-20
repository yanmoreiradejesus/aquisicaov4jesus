UPDATE public.crm_call_events
SET
  gravacao_url = COALESCE(gravacao_url, raw_payload->>'recordUrl'),
  status = COALESCE(status, raw_payload->>'hangupCause'),
  operador = COALESCE(operador, raw_payload->>'caller')
WHERE provider = 'api4com'
  AND raw_payload ? 'recordUrl';