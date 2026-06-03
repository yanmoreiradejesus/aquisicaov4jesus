
-- Tabela para guardar TODO webhook bruto antes de qualquer filtro
CREATE TABLE public.webhook_raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  source_ip TEXT,
  headers JSONB,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  skip_reason TEXT,
  resolved_tenant_id UUID,
  resolved_lead_id UUID,
  resolved_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_raw_events_provider_created ON public.webhook_raw_events(provider, created_at DESC);
CREATE INDEX idx_webhook_raw_events_tenant ON public.webhook_raw_events(resolved_tenant_id, created_at DESC);
CREATE INDEX idx_webhook_raw_events_skip_reason ON public.webhook_raw_events(skip_reason) WHERE skip_reason IS NOT NULL;

GRANT SELECT ON public.webhook_raw_events TO authenticated;
GRANT ALL ON public.webhook_raw_events TO service_role;

ALTER TABLE public.webhook_raw_events ENABLE ROW LEVEL SECURITY;

-- Somente super_admin_v4 ou admin do tenant resolvido podem ler
CREATE POLICY "Read webhook raw events admin"
  ON public.webhook_raw_events FOR SELECT
  USING (
    has_role(auth.uid(), 'super_admin_v4'::app_role)
    OR (
      resolved_tenant_id = current_tenant_id()
      AND has_role(auth.uid(), 'admin'::app_role)
    )
  );
