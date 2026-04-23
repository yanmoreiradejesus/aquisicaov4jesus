ALTER TABLE public.crm_atividades
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_sync_status TEXT,
  ADD COLUMN IF NOT EXISTS google_sync_error TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_atividades_google_event_id ON public.crm_atividades(google_event_id) WHERE google_event_id IS NOT NULL;