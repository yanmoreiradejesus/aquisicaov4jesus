
-- Tabela de preços por modelo
CREATE TABLE public.ai_model_pricing (
  model TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  input_price_per_1m_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  output_price_per_1m_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  audio_price_per_minute_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_model_pricing TO authenticated;
GRANT ALL ON public.ai_model_pricing TO service_role;
ALTER TABLE public.ai_model_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_model_pricing_read_auth" ON public.ai_model_pricing
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_model_pricing_write_superadmin" ON public.ai_model_pricing
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin_v4'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin_v4'::app_role));

-- Seed inicial (preços públicos aproximados em USD por 1M tokens)
INSERT INTO public.ai_model_pricing (model, provider, input_price_per_1m_usd, output_price_per_1m_usd, audio_price_per_minute_usd, notes) VALUES
  ('google/gemini-3-flash-preview', 'lovable', 0.30, 2.50, 0, 'Gemini 3 Flash via Lovable AI'),
  ('google/gemini-2.5-flash', 'lovable', 0.30, 2.50, 0, 'Gemini 2.5 Flash'),
  ('google/gemini-2.5-flash-lite', 'lovable', 0.10, 0.40, 0, 'Gemini 2.5 Flash Lite'),
  ('google/gemini-2.5-pro', 'lovable', 1.25, 10.00, 0, 'Gemini 2.5 Pro'),
  ('openai/gpt-5-mini', 'lovable', 0.25, 2.00, 0, 'GPT-5 mini via gateway'),
  ('openai/gpt-5', 'lovable', 1.25, 10.00, 0, 'GPT-5 via gateway'),
  ('claude-sonnet-4-20250514', 'anthropic', 3.00, 15.00, 0, 'Claude Sonnet 4'),
  ('claude-opus-4-20250514', 'anthropic', 15.00, 75.00, 0, 'Claude Opus 4'),
  ('whisper-1', 'lovable', 0, 0, 0.006, 'Transcrição de áudio (por minuto)');

-- Eventos de uso
CREATE TABLE public.ai_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id UUID,
  function_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  audio_seconds INT NOT NULL DEFAULT 0,
  cost_usd NUMERIC(14,8) NOT NULL DEFAULT 0,
  cost_brl NUMERIC(14,4) NOT NULL DEFAULT 0,
  request_id TEXT,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  metadata JSONB
);

CREATE INDEX idx_ai_usage_events_tenant_created ON public.ai_usage_events (tenant_id, created_at DESC);
CREATE INDEX idx_ai_usage_events_function ON public.ai_usage_events (function_name);
CREATE INDEX idx_ai_usage_events_user ON public.ai_usage_events (user_id);
CREATE INDEX idx_ai_usage_events_created ON public.ai_usage_events (created_at DESC);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_events_select_superadmin" ON public.ai_usage_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin_v4'::app_role));

-- RPCs
CREATE OR REPLACE FUNCTION public.get_ai_usage_by_tenant(p_start TIMESTAMPTZ, p_end TIMESTAMPTZ)
RETURNS TABLE (
  tenant_id UUID,
  client_name TEXT,
  client_slug TEXT,
  calls BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  total_tokens BIGINT,
  cost_usd NUMERIC,
  cost_brl NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.tenant_id,
    t.client_name,
    t.client_slug,
    COUNT(*)::BIGINT,
    COALESCE(SUM(e.input_tokens),0)::BIGINT,
    COALESCE(SUM(e.output_tokens),0)::BIGINT,
    COALESCE(SUM(e.total_tokens),0)::BIGINT,
    COALESCE(SUM(e.cost_usd),0),
    COALESCE(SUM(e.cost_brl),0)
  FROM public.ai_usage_events e
  LEFT JOIN public.tenants t ON t.id = e.tenant_id
  WHERE e.created_at >= p_start AND e.created_at <= p_end
    AND public.has_role(auth.uid(), 'super_admin_v4'::app_role)
  GROUP BY e.tenant_id, t.client_name, t.client_slug
  ORDER BY COALESCE(SUM(e.cost_usd),0) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_usage_breakdown(
  p_tenant UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE (
  day DATE,
  function_name TEXT,
  user_id UUID,
  user_name TEXT,
  model TEXT,
  provider TEXT,
  calls BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  total_tokens BIGINT,
  cost_usd NUMERIC,
  cost_brl NUMERIC
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.created_at::DATE,
    e.function_name,
    e.user_id,
    p.full_name,
    e.model,
    e.provider,
    COUNT(*)::BIGINT,
    COALESCE(SUM(e.input_tokens),0)::BIGINT,
    COALESCE(SUM(e.output_tokens),0)::BIGINT,
    COALESCE(SUM(e.total_tokens),0)::BIGINT,
    COALESCE(SUM(e.cost_usd),0),
    COALESCE(SUM(e.cost_brl),0)
  FROM public.ai_usage_events e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.created_at >= p_start AND e.created_at <= p_end
    AND (p_tenant IS NULL OR e.tenant_id = p_tenant)
    AND public.has_role(auth.uid(), 'super_admin_v4'::app_role)
  GROUP BY e.created_at::DATE, e.function_name, e.user_id, p.full_name, e.model, e.provider
  ORDER BY e.created_at::DATE DESC, COALESCE(SUM(e.cost_usd),0) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_usage_daily(
  p_tenant UUID,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE (day DATE, cost_usd NUMERIC, cost_brl NUMERIC, total_tokens BIGINT, calls BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    e.created_at::DATE,
    COALESCE(SUM(e.cost_usd),0),
    COALESCE(SUM(e.cost_brl),0),
    COALESCE(SUM(e.total_tokens),0)::BIGINT,
    COUNT(*)::BIGINT
  FROM public.ai_usage_events e
  WHERE e.created_at >= p_start AND e.created_at <= p_end
    AND (p_tenant IS NULL OR e.tenant_id = p_tenant)
    AND public.has_role(auth.uid(), 'super_admin_v4'::app_role)
  GROUP BY e.created_at::DATE
  ORDER BY e.created_at::DATE;
$$;
