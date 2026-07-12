
-- Enums
CREATE TYPE public.expansao_etapa AS ENUM ('mapeada','proposta','negociacao','ganho','perdido');
CREATE TYPE public.expansao_tipo_ganho AS ENUM ('aumento_fee','escopo_fechado','ambos');

-- Table
CREATE TABLE public.crm_expansoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  projeto_id uuid NOT NULL REFERENCES public.crm_projetos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  etapa public.expansao_etapa NOT NULL DEFAULT 'mapeada',
  responsavel_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  valor_estimado numeric,
  tipo_ganho public.expansao_tipo_ganho,
  valor_aumento_fee numeric,
  valor_escopo_fechado numeric,
  data_ganho timestamptz,
  motivo_perda text,
  data_proposta timestamptz,
  data_negociacao timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_expansoes_tenant ON public.crm_expansoes(tenant_id);
CREATE INDEX idx_crm_expansoes_projeto ON public.crm_expansoes(projeto_id);
CREATE INDEX idx_crm_expansoes_etapa ON public.crm_expansoes(etapa);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_expansoes TO authenticated;
GRANT ALL ON public.crm_expansoes TO service_role;

ALTER TABLE public.crm_expansoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can select expansoes"
  ON public.crm_expansoes FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members can insert expansoes"
  ON public.crm_expansoes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members can update expansoes"
  ON public.crm_expansoes FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members can delete expansoes"
  ON public.crm_expansoes FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

-- Triggers: tenant_id + updated_at
CREATE TRIGGER crm_expansoes_set_tenant
  BEFORE INSERT ON public.crm_expansoes
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER crm_expansoes_updated_at
  BEFORE UPDATE ON public.crm_expansoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: stamp etapa dates
CREATE OR REPLACE FUNCTION public.stamp_expansao_etapa_dates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    IF NEW.etapa = 'proposta' AND NEW.data_proposta IS NULL THEN
      NEW.data_proposta := now();
    ELSIF NEW.etapa = 'negociacao' AND NEW.data_negociacao IS NULL THEN
      NEW.data_negociacao := now();
      IF NEW.data_proposta IS NULL THEN NEW.data_proposta := now(); END IF;
    ELSIF NEW.etapa = 'ganho' AND NEW.data_ganho IS NULL THEN
      NEW.data_ganho := now();
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER crm_expansoes_stamp_dates
  BEFORE INSERT OR UPDATE ON public.crm_expansoes
  FOR EACH ROW EXECUTE FUNCTION public.stamp_expansao_etapa_dates();

-- Enable page for existing tenants
INSERT INTO public.tenant_enabled_pages (tenant_id, page_path)
SELECT id, '/comercial/expansao' FROM public.tenants
ON CONFLICT DO NOTHING;
