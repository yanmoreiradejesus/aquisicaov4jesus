
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_slug TEXT NOT NULL UNIQUE,
  client_logo_url TEXT,
  primary_color_hsl TEXT DEFAULT '217 91% 60%',
  app_base_url TEXT,
  sheet_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
  voip_provider TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  active BOOLEAN NOT NULL DEFAULT true,
  v4_contact TEXT,
  internal_notes TEXT,
  provisioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tenants (id, client_name, client_slug, client_logo_url, primary_color_hsl, app_base_url, sheet_ids, voip_provider, active, status, provisioned_at)
SELECT
  id,
  COALESCE(client_name, 'V4 Jesus'),
  COALESCE(client_slug, 'jesus'),
  client_logo_url,
  COALESCE(primary_color_hsl, '217 91% 60%'),
  COALESCE(app_base_url, 'https://v4jesus.com'),
  COALESCE(sheet_ids, '{}'::jsonb),
  voip_provider,
  COALESCE(active, true),
  'active',
  COALESCE(created_at, now())
FROM public.tenant_config
LIMIT 1;

INSERT INTO public.tenants (client_name, client_slug, app_base_url, status)
SELECT 'V4 Jesus', 'jesus', 'https://v4jesus.com', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.tenants);

DO $$
DECLARE
  v_jesus_id UUID;
  v_lit TEXT;
  t TEXT;
  tables_full_notnull TEXT[] := ARRAY[
    'profiles','user_page_access','role_access_templates',
    'crm_leads','crm_oportunidades','crm_atividades','crm_call_events','crm_copilot_attachments',
    'accounts','cobrancas','monthly_goals','mix_goals','voip_accounts','user_google_tokens'
  ];
BEGIN
  SELECT id INTO v_jesus_id FROM public.tenants WHERE client_slug = 'jesus' LIMIT 1;
  v_lit := quote_literal(v_jesus_id::text);

  -- user_roles: tenant_id nullable (super_admin_v4 is cross-tenant)
  EXECUTE 'ALTER TABLE public.user_roles ADD COLUMN tenant_id UUID REFERENCES public.tenants(id)';
  EXECUTE format('UPDATE public.user_roles SET tenant_id = %s::uuid WHERE tenant_id IS NULL AND role <> ''super_admin_v4''', v_lit);
  EXECUTE 'CREATE INDEX idx_user_roles_tenant ON public.user_roles(tenant_id)';

  FOREACH t IN ARRAY tables_full_notnull LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id UUID REFERENCES public.tenants(id)', t);
    EXECUTE format('UPDATE public.%I SET tenant_id = %s::uuid WHERE tenant_id IS NULL', t, v_lit);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT %s::uuid', t, v_lit);
    EXECUTE format('CREATE INDEX idx_%I_tenant ON public.%I(tenant_id)', t, t);
  END LOOP;

  -- role_access_templates PK
  ALTER TABLE public.role_access_templates DROP CONSTRAINT IF EXISTS role_access_templates_pkey;
  ALTER TABLE public.role_access_templates ADD PRIMARY KEY (tenant_id, cargo);

  -- monthly_goals + mix_goals unique on (tenant, year, month)
  CREATE UNIQUE INDEX IF NOT EXISTS uq_monthly_goals_tenant_period ON public.monthly_goals(tenant_id, year, month);
  CREATE UNIQUE INDEX IF NOT EXISTS uq_mix_goals_tenant_period ON public.mix_goals(tenant_id, year, month);
END $$;

-- current_tenant_id() helper
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- handle_new_user: attach to default tenant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
  v_default_tenant UUID;
BEGIN
  SELECT id INTO v_default_tenant FROM public.tenants WHERE client_slug = 'jesus' LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, approved, tenant_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', FALSE, v_default_tenant);

  SELECT COUNT(*) = 1 INTO is_first_user FROM public.profiles;

  IF is_first_user THEN
    UPDATE public.profiles SET approved = TRUE WHERE id = NEW.id;
    INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (NEW.id, 'admin', v_default_tenant);
    INSERT INTO public.user_page_access (user_id, page_path, tenant_id) VALUES
      (NEW.id, '/aquisicao/funil', v_default_tenant),
      (NEW.id, '/aquisicao/dashboard', v_default_tenant),
      (NEW.id, '/aquisicao/insights', v_default_tenant),
      (NEW.id, '/aquisicao/financeiro', v_default_tenant),
      (NEW.id, '/aquisicao/legado/funil', v_default_tenant),
      (NEW.id, '/aquisicao/legado/meta', v_default_tenant);
  END IF;

  RETURN NEW;
END;
$$;

-- tenants RLS
CREATE POLICY "Authenticated read own tenant" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Super admin V4 manage tenants" ON public.tenants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin_v4'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin_v4'));

-- profiles
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view approved profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "View profiles same tenant" ON public.profiles FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR auth.uid() = id OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
CREATE POLICY "Admins update tenant profiles" ON public.profiles FOR UPDATE
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- user_roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "View roles same tenant" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Admins manage tenant roles" ON public.user_roles FOR ALL
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'))
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- user_page_access
DROP POLICY IF EXISTS "Admins can manage access" ON public.user_page_access;
DROP POLICY IF EXISTS "Admins can view all access" ON public.user_page_access;
DROP POLICY IF EXISTS "Users can view own access" ON public.user_page_access;
CREATE POLICY "View access same tenant or own" ON public.user_page_access FOR SELECT
  USING (auth.uid() = user_id OR (tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Admins manage tenant access" ON public.user_page_access FOR ALL
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'))
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- role_access_templates
DROP POLICY IF EXISTS "Admin manage templates" ON public.role_access_templates;
DROP POLICY IF EXISTS "Authenticated read templates" ON public.role_access_templates;
CREATE POLICY "Read templates same tenant" ON public.role_access_templates FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Admin manage tenant templates" ON public.role_access_templates FOR ALL
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'))
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- crm_leads
DROP POLICY IF EXISTS "Admin delete leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Approved users update leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Authenticated insert leads" ON public.crm_leads;
DROP POLICY IF EXISTS "Authenticated read leads" ON public.crm_leads;
CREATE POLICY "Read leads tenant" ON public.crm_leads FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Insert leads tenant" ON public.crm_leads FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Update leads tenant" ON public.crm_leads FOR UPDATE
  USING ((tenant_id = public.current_tenant_id() AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Delete leads tenant" ON public.crm_leads FOR DELETE
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- crm_oportunidades
DROP POLICY IF EXISTS "Admin delete oport" ON public.crm_oportunidades;
DROP POLICY IF EXISTS "Approved users update oport" ON public.crm_oportunidades;
DROP POLICY IF EXISTS "Authenticated insert oport" ON public.crm_oportunidades;
DROP POLICY IF EXISTS "Authenticated read oport" ON public.crm_oportunidades;
CREATE POLICY "Read oport tenant" ON public.crm_oportunidades FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Insert oport tenant" ON public.crm_oportunidades FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Update oport tenant" ON public.crm_oportunidades FOR UPDATE
  USING ((tenant_id = public.current_tenant_id() AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Delete oport tenant" ON public.crm_oportunidades FOR DELETE
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- crm_atividades
DROP POLICY IF EXISTS "Approved users delete atividades" ON public.crm_atividades;
DROP POLICY IF EXISTS "Approved users update atividades" ON public.crm_atividades;
DROP POLICY IF EXISTS "Authenticated insert atividades" ON public.crm_atividades;
DROP POLICY IF EXISTS "Authenticated read atividades" ON public.crm_atividades;
CREATE POLICY "Read atividades tenant" ON public.crm_atividades FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Insert atividades tenant" ON public.crm_atividades FOR INSERT
  WITH CHECK ((tenant_id = public.current_tenant_id() AND auth.uid() = usuario_id) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Update atividades tenant" ON public.crm_atividades FOR UPDATE
  USING ((tenant_id = public.current_tenant_id() AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Delete atividades tenant" ON public.crm_atividades FOR DELETE
  USING ((tenant_id = public.current_tenant_id() AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- crm_call_events
DROP POLICY IF EXISTS "Admin delete call events" ON public.crm_call_events;
DROP POLICY IF EXISTS "Admin update call events" ON public.crm_call_events;
DROP POLICY IF EXISTS "Authenticated read call events" ON public.crm_call_events;
CREATE POLICY "Read call events tenant" ON public.crm_call_events FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Update call events tenant" ON public.crm_call_events FOR UPDATE
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Delete call events tenant" ON public.crm_call_events FOR DELETE
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- crm_copilot_attachments
DROP POLICY IF EXISTS "Authenticated read copilot attachments" ON public.crm_copilot_attachments;
DROP POLICY IF EXISTS "Owner or admin delete copilot attachments rows" ON public.crm_copilot_attachments;
DROP POLICY IF EXISTS "Users insert own copilot attachments rows" ON public.crm_copilot_attachments;
CREATE POLICY "Read copilot attach tenant" ON public.crm_copilot_attachments FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Insert copilot attach tenant" ON public.crm_copilot_attachments FOR INSERT
  WITH CHECK ((tenant_id = public.current_tenant_id() AND auth.uid() = user_id) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Delete copilot attach tenant" ON public.crm_copilot_attachments FOR DELETE
  USING ((tenant_id = public.current_tenant_id() AND (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- accounts
DROP POLICY IF EXISTS "Admin delete accounts" ON public.accounts;
DROP POLICY IF EXISTS "Approved users update accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated insert accounts" ON public.accounts;
DROP POLICY IF EXISTS "Authenticated read accounts" ON public.accounts;
CREATE POLICY "Read accounts tenant" ON public.accounts FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Insert accounts tenant" ON public.accounts FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Update accounts tenant" ON public.accounts FOR UPDATE
  USING ((tenant_id = public.current_tenant_id() AND (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Delete accounts tenant" ON public.accounts FOR DELETE
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- cobrancas
DROP POLICY IF EXISTS "Admin delete cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Admin update cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Authenticated insert cobrancas" ON public.cobrancas;
DROP POLICY IF EXISTS "Authenticated read cobrancas" ON public.cobrancas;
CREATE POLICY "Read cobrancas tenant" ON public.cobrancas FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Insert cobrancas tenant" ON public.cobrancas FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Update cobrancas tenant" ON public.cobrancas FOR UPDATE
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Delete cobrancas tenant" ON public.cobrancas FOR DELETE
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- monthly_goals
DROP POLICY IF EXISTS "Admins can manage monthly_goals" ON public.monthly_goals;
DROP POLICY IF EXISTS "Authenticated users can read monthly_goals" ON public.monthly_goals;
CREATE POLICY "Read monthly_goals tenant" ON public.monthly_goals FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Manage monthly_goals tenant" ON public.monthly_goals FOR ALL
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'))
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- mix_goals
DROP POLICY IF EXISTS "Admins can manage mix_goals" ON public.mix_goals;
DROP POLICY IF EXISTS "Authenticated users can read mix_goals" ON public.mix_goals;
CREATE POLICY "Read mix_goals tenant" ON public.mix_goals FOR SELECT
  USING (tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Manage mix_goals tenant" ON public.mix_goals FOR ALL
  USING ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'))
  WITH CHECK ((tenant_id = public.current_tenant_id() AND public.has_role(auth.uid(), 'admin')) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- voip_accounts
DROP POLICY IF EXISTS "Users delete own voip accounts" ON public.voip_accounts;
DROP POLICY IF EXISTS "Users insert own voip accounts" ON public.voip_accounts;
DROP POLICY IF EXISTS "Users update own voip accounts" ON public.voip_accounts;
DROP POLICY IF EXISTS "Users view own voip accounts" ON public.voip_accounts;
CREATE POLICY "View voip tenant" ON public.voip_accounts FOR SELECT
  USING ((tenant_id = public.current_tenant_id() AND (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Insert voip tenant" ON public.voip_accounts FOR INSERT
  WITH CHECK ((tenant_id = public.current_tenant_id() AND (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Update voip tenant" ON public.voip_accounts FOR UPDATE
  USING ((tenant_id = public.current_tenant_id() AND (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));
CREATE POLICY "Delete voip tenant" ON public.voip_accounts FOR DELETE
  USING ((tenant_id = public.current_tenant_id() AND (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))) OR public.has_role(auth.uid(), 'super_admin_v4'));

-- Drop legacy tables
DROP TABLE IF EXISTS public.tenant_config;
DROP TABLE IF EXISTS public.v4_hub_clients;

-- Drop the role_access_templates default for tenant_id since PK uniqueness already constrains
ALTER TABLE public.role_access_templates ALTER COLUMN tenant_id DROP DEFAULT;
