
-- 1. ENUM
CREATE TYPE public.squad_type AS ENUM ('strikers', 'fenix', 'saber');

-- 2. ALTER accounts (todas nullable)
ALTER TABLE public.accounts
  ADD COLUMN squad public.squad_type,
  ADD COLUMN ekyte_workspace_id bigint,
  ADD COLUMN mrr numeric,
  ADD COLUMN mrr_variavel numeric,
  ADD COLUMN gt_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN designer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN social_media_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN playbook_url text,
  ADD COLUMN growthpack_url text,
  ADD COLUMN drive_url text;

CREATE INDEX IF NOT EXISTS accounts_ekyte_workspace_id_idx
  ON public.accounts(ekyte_workspace_id);

-- 3. account_scope
CREATE TABLE public.account_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  item text NOT NULL,
  quantidade_contratada numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, item)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_scope TO authenticated;
GRANT ALL ON public.account_scope TO service_role;

ALTER TABLE public.account_scope ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_account_scope" ON public.account_scope
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_insert_account_scope" ON public.account_scope
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_update_account_scope" ON public.account_scope
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_delete_account_scope" ON public.account_scope
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE TRIGGER set_tenant_id_account_scope
  BEFORE INSERT ON public.account_scope
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER update_account_scope_updated_at
  BEFORE UPDATE ON public.account_scope
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. squad_scope_template
CREATE TABLE public.squad_scope_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  squad public.squad_type NOT NULL,
  item text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, squad, item)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_scope_template TO authenticated;
GRANT ALL ON public.squad_scope_template TO service_role;

ALTER TABLE public.squad_scope_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_squad_template" ON public.squad_scope_template
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_insert_squad_template" ON public.squad_scope_template
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_update_squad_template" ON public.squad_scope_template
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant_delete_squad_template" ON public.squad_scope_template
  FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE TRIGGER set_tenant_id_squad_template
  BEFORE INSERT ON public.squad_scope_template
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TRIGGER update_squad_template_updated_at
  BEFORE UPDATE ON public.squad_scope_template
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Seed Jesus & Co
INSERT INTO public.squad_scope_template (tenant_id, squad, item, ordem) VALUES
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','saber','Estruturação Estratégica',1),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','saber','Estruturação Comercial',2),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','saber','Branding',3),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Gestão de Tráfego',1),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Criativos',2),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Social Media',3),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','CRM',4),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Estruturação Estratégica',5),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Estruturação Comercial',6),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','strikers','Branding',7),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Gestão de Tráfego',1),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Criativos',2),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Social Media',3),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','CRM',4),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Estruturação Estratégica',5),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Estruturação Comercial',6),
('ca48961c-9ee0-470d-9d9e-cfecbd7e26c2','fenix','Branding',7);
