
-- Add last phone contact column to leads
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS ultimo_contato_telefonico TIMESTAMPTZ;

-- Call events table
CREATE TABLE IF NOT EXISTS public.crm_call_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NULL REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT '3cplus',
  event_type TEXT NOT NULL,
  call_id TEXT NULL,
  telefone TEXT NULL,
  telefone_normalizado TEXT NULL,
  operador TEXT NULL,
  duracao_seg INTEGER NULL,
  status TEXT NULL,
  gravacao_url TEXT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_call_events_lead_id ON public.crm_call_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_call_events_telefone_norm ON public.crm_call_events(telefone_normalizado);
CREATE INDEX IF NOT EXISTS idx_crm_call_events_created_at ON public.crm_call_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_call_events_call_id ON public.crm_call_events(call_id);

ALTER TABLE public.crm_call_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read call events"
  ON public.crm_call_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin update call events"
  ON public.crm_call_events FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete call events"
  ON public.crm_call_events FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER TABLE public.crm_call_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_call_events;
