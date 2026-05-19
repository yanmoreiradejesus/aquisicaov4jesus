-- Resolve tenant by hostname for public signup/domain locking without exposing full tenant table writes
CREATE OR REPLACE FUNCTION public.resolve_tenant_by_hostname(_hostname text)
RETURNS TABLE (
  id uuid,
  client_name text,
  client_slug text,
  client_logo_url text,
  primary_color_hsl text,
  app_base_url text,
  sheet_ids jsonb,
  voip_provider text,
  active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.client_name,
    t.client_slug,
    t.client_logo_url,
    t.primary_color_hsl,
    t.app_base_url,
    t.sheet_ids,
    t.voip_provider,
    t.active
  FROM public.tenants t
  WHERE t.active = true
    AND lower(regexp_replace(regexp_replace(coalesce(t.app_base_url, ''), '^https?://', ''), '/.*$', '')) = lower(_hostname)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_hostname(text) TO anon, authenticated;

-- Ensure automatic tenant assignment follows the active tenant selected by super_admin_v4
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT coalesce(active_tenant_id, tenant_id)
    INTO v_tenant
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_tenant IS NOT NULL THEN
      NEW.tenant_id := v_tenant;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Tenant-scoped operational data must stay scoped to the active tenant even for super admins.
DROP POLICY IF EXISTS "Read accounts tenant" ON public.accounts;
CREATE POLICY "Read accounts tenant" ON public.accounts
FOR SELECT USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Insert accounts tenant" ON public.accounts;
CREATE POLICY "Insert accounts tenant" ON public.accounts
FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Update accounts tenant" ON public.accounts;
CREATE POLICY "Update accounts tenant" ON public.accounts
FOR UPDATE USING (tenant_id = current_tenant_id() AND (is_approved(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Delete accounts tenant" ON public.accounts;
CREATE POLICY "Delete accounts tenant" ON public.accounts
FOR DELETE USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Read leads tenant" ON public.crm_leads;
CREATE POLICY "Read leads tenant" ON public.crm_leads
FOR SELECT USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Insert leads tenant" ON public.crm_leads;
CREATE POLICY "Insert leads tenant" ON public.crm_leads
FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Update leads tenant" ON public.crm_leads;
CREATE POLICY "Update leads tenant" ON public.crm_leads
FOR UPDATE USING (tenant_id = current_tenant_id() AND (is_approved(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Delete leads tenant" ON public.crm_leads;
CREATE POLICY "Delete leads tenant" ON public.crm_leads
FOR DELETE USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Read oport tenant" ON public.crm_oportunidades;
CREATE POLICY "Read oport tenant" ON public.crm_oportunidades
FOR SELECT USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Insert oport tenant" ON public.crm_oportunidades;
CREATE POLICY "Insert oport tenant" ON public.crm_oportunidades
FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Update oport tenant" ON public.crm_oportunidades;
CREATE POLICY "Update oport tenant" ON public.crm_oportunidades
FOR UPDATE USING (tenant_id = current_tenant_id() AND (is_approved(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Delete oport tenant" ON public.crm_oportunidades;
CREATE POLICY "Delete oport tenant" ON public.crm_oportunidades
FOR DELETE USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Read atividades tenant" ON public.crm_atividades;
CREATE POLICY "Read atividades tenant" ON public.crm_atividades
FOR SELECT USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Insert atividades tenant" ON public.crm_atividades;
CREATE POLICY "Insert atividades tenant" ON public.crm_atividades
FOR INSERT WITH CHECK (tenant_id = current_tenant_id() AND (auth.uid() = usuario_id OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Update atividades tenant" ON public.crm_atividades;
CREATE POLICY "Update atividades tenant" ON public.crm_atividades
FOR UPDATE USING (tenant_id = current_tenant_id() AND (is_approved(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Delete atividades tenant" ON public.crm_atividades;
CREATE POLICY "Delete atividades tenant" ON public.crm_atividades
FOR DELETE USING (tenant_id = current_tenant_id() AND (is_approved(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Read call events tenant" ON public.crm_call_events;
CREATE POLICY "Read call events tenant" ON public.crm_call_events
FOR SELECT USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Update call events tenant" ON public.crm_call_events;
CREATE POLICY "Update call events tenant" ON public.crm_call_events
FOR UPDATE USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Delete call events tenant" ON public.crm_call_events;
CREATE POLICY "Delete call events tenant" ON public.crm_call_events
FOR DELETE USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Read cobrancas tenant" ON public.cobrancas;
CREATE POLICY "Read cobrancas tenant" ON public.cobrancas
FOR SELECT USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Insert cobrancas tenant" ON public.cobrancas;
CREATE POLICY "Insert cobrancas tenant" ON public.cobrancas
FOR INSERT WITH CHECK (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Update cobrancas tenant" ON public.cobrancas;
CREATE POLICY "Update cobrancas tenant" ON public.cobrancas
FOR UPDATE USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Delete cobrancas tenant" ON public.cobrancas;
CREATE POLICY "Delete cobrancas tenant" ON public.cobrancas
FOR DELETE USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Read mix_goals tenant" ON public.mix_goals;
CREATE POLICY "Read mix_goals tenant" ON public.mix_goals
FOR SELECT USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Manage mix_goals tenant" ON public.mix_goals;
CREATE POLICY "Manage mix_goals tenant" ON public.mix_goals
FOR ALL USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)))
WITH CHECK (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Read monthly_goals tenant" ON public.monthly_goals;
CREATE POLICY "Read monthly_goals tenant" ON public.monthly_goals
FOR SELECT USING (tenant_id = current_tenant_id());

DROP POLICY IF EXISTS "Manage monthly_goals tenant" ON public.monthly_goals;
CREATE POLICY "Manage monthly_goals tenant" ON public.monthly_goals
FOR ALL USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)))
WITH CHECK (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "View voip tenant" ON public.voip_accounts;
CREATE POLICY "View voip tenant" ON public.voip_accounts
FOR SELECT USING (tenant_id = current_tenant_id() AND ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Insert voip tenant" ON public.voip_accounts;
CREATE POLICY "Insert voip tenant" ON public.voip_accounts
FOR INSERT WITH CHECK (tenant_id = current_tenant_id() AND ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Update voip tenant" ON public.voip_accounts;
CREATE POLICY "Update voip tenant" ON public.voip_accounts
FOR UPDATE USING (tenant_id = current_tenant_id() AND ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Delete voip tenant" ON public.voip_accounts;
CREATE POLICY "Delete voip tenant" ON public.voip_accounts
FOR DELETE USING (tenant_id = current_tenant_id() AND ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "Read enabled pages tenant" ON public.tenant_enabled_pages;
CREATE POLICY "Read enabled pages tenant" ON public.tenant_enabled_pages
FOR SELECT USING (tenant_id = current_tenant_id() OR has_role(auth.uid(), 'super_admin_v4'::app_role));

DROP POLICY IF EXISTS "View profiles same tenant" ON public.profiles;
CREATE POLICY "View profiles same tenant" ON public.profiles
FOR SELECT USING ((tenant_id = current_tenant_id()) OR (auth.uid() = id));

DROP POLICY IF EXISTS "Admins update tenant profiles" ON public.profiles;
CREATE POLICY "Admins update tenant profiles" ON public.profiles
FOR UPDATE USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "View access same tenant or own" ON public.user_page_access;
CREATE POLICY "View access same tenant or own" ON public.user_page_access
FOR SELECT USING ((auth.uid() = user_id) OR (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role))));

DROP POLICY IF EXISTS "Admins manage tenant access" ON public.user_page_access;
CREATE POLICY "Admins manage tenant access" ON public.user_page_access
FOR ALL USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)))
WITH CHECK (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));

DROP POLICY IF EXISTS "View roles same tenant" ON public.user_roles;
CREATE POLICY "View roles same tenant" ON public.user_roles
FOR SELECT USING ((auth.uid() = user_id) OR (tenant_id = current_tenant_id()));

DROP POLICY IF EXISTS "Admins manage tenant roles" ON public.user_roles;
CREATE POLICY "Admins manage tenant roles" ON public.user_roles
FOR ALL USING (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)))
WITH CHECK (tenant_id = current_tenant_id() AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin_v4'::app_role)));