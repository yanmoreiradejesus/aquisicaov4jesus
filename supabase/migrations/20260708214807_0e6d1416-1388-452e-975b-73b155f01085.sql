
-- ============ enum status ============
DO $$ BEGIN
  CREATE TYPE public.projeto_status AS ENUM ('ativo','em_risco','pausado','encerrado','churn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ crm_projetos ============
CREATE TABLE IF NOT EXISTS public.crm_projetos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES public.accounts(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  status_projeto public.projeto_status NOT NULL DEFAULT 'ativo',
  descricao TEXT,
  objetivos TEXT,
  kpis_alvo JSONB NOT NULL DEFAULT '[]'::jsonb,
  prazo_inicio DATE,
  prazo_fim DATE,
  stack JSONB NOT NULL DEFAULT '[]'::jsonb,
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  time JSONB NOT NULL DEFAULT '[]'::jsonb,
  documentacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_projetos_tenant_idx ON public.crm_projetos(tenant_id);
CREATE INDEX IF NOT EXISTS crm_projetos_account_idx ON public.crm_projetos(account_id);
CREATE INDEX IF NOT EXISTS crm_projetos_status_idx ON public.crm_projetos(status_projeto);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_projetos TO authenticated;
GRANT ALL ON public.crm_projetos TO service_role;

ALTER TABLE public.crm_projetos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read projetos tenant" ON public.crm_projetos
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Insert projetos tenant" ON public.crm_projetos
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Update projetos tenant" ON public.crm_projetos
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Delete projetos admin" ON public.crm_projetos
  FOR DELETE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'super_admin_v4'::app_role))
  );

CREATE TRIGGER trg_crm_projetos_updated_at
  BEFORE UPDATE ON public.crm_projetos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- tenant_id auto-fill on insert (reusa função global)
CREATE TRIGGER trg_crm_projetos_set_tenant
  BEFORE INSERT ON public.crm_projetos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- ============ crm_projeto_anexos ============
CREATE TABLE IF NOT EXISTS public.crm_projeto_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id UUID NOT NULL REFERENCES public.crm_projetos(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT,
  size_bytes BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_projeto_anexos_projeto_idx ON public.crm_projeto_anexos(projeto_id);
CREATE INDEX IF NOT EXISTS crm_projeto_anexos_tenant_idx ON public.crm_projeto_anexos(tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_projeto_anexos TO authenticated;
GRANT ALL ON public.crm_projeto_anexos TO service_role;

ALTER TABLE public.crm_projeto_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read anexos tenant" ON public.crm_projeto_anexos
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Insert anexos tenant" ON public.crm_projeto_anexos
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Delete anexos tenant" ON public.crm_projeto_anexos
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE TRIGGER trg_crm_projeto_anexos_set_tenant
  BEFORE INSERT ON public.crm_projeto_anexos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- ============ trigger: auto-cria projeto ao concluir onboarding ============
CREATE OR REPLACE FUNCTION public.auto_create_projeto_on_onboarding_concluida()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarding_status = 'concluida'
     AND (OLD.onboarding_status IS DISTINCT FROM 'concluida') THEN
    INSERT INTO public.crm_projetos (account_id, tenant_id, nome)
    VALUES (NEW.id, NEW.tenant_id, COALESCE(NEW.cliente_nome, 'Projeto sem nome'))
    ON CONFLICT (account_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_create_projeto ON public.accounts;
CREATE TRIGGER trg_auto_create_projeto
  AFTER UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_projeto_on_onboarding_concluida();

-- ============ backfill ============
INSERT INTO public.crm_projetos (account_id, tenant_id, nome)
SELECT a.id, a.tenant_id, COALESCE(a.cliente_nome, 'Projeto sem nome')
FROM public.accounts a
WHERE a.onboarding_status = 'concluida'
ON CONFLICT (account_id) DO NOTHING;

-- ============ habilitar página nos tenants + dar acesso a quem tem Onboarding ============
INSERT INTO public.tenant_enabled_pages (tenant_id, page_path)
SELECT t.id, '/comercial/projetos'
FROM public.tenants t
WHERE t.active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.user_page_access (user_id, page_path, tenant_id)
SELECT upa.user_id, '/comercial/projetos', upa.tenant_id
FROM public.user_page_access upa
WHERE upa.page_path = '/comercial/onboarding'
ON CONFLICT DO NOTHING;
