DROP POLICY IF EXISTS "Read enabled pages tenant" ON public.tenant_enabled_pages;
CREATE POLICY "Read enabled pages tenant"
  ON public.tenant_enabled_pages
  FOR SELECT
  USING (tenant_id = public.current_tenant_id());