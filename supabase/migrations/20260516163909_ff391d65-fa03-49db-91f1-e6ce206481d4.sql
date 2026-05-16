DROP INDEX IF EXISTS public.crm_call_events_provider_call_id_uniq;

ALTER TABLE public.crm_call_events
ADD CONSTRAINT crm_call_events_provider_call_id_key
UNIQUE (provider, call_id);