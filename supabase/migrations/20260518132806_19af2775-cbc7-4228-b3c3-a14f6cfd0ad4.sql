-- Tabela de páginas habilitadas por tenant
CREATE TABLE public.tenant_enabled_pages (
  tenant_id UUID NOT NULL,
  page_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, page_path)
);

ALTER TABLE public.tenant_enabled_pages ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer usuário do tenant pode ver
CREATE POLICY "Read enabled pages tenant"
ON public.tenant_enabled_pages
FOR SELECT
USING (
  tenant_id = current_tenant_id()
  OR has_role(auth.uid(), 'super_admin_v4'::app_role)
);

-- Apenas super_admin_v4 gerencia
CREATE POLICY "Super admin manage enabled pages"
ON public.tenant_enabled_pages
FOR ALL
USING (has_role(auth.uid(), 'super_admin_v4'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin_v4'::app_role));

-- Seed: habilita TODAS as páginas atuais para todos os tenants existentes
-- (mantém o comportamento atual para V4 Jesus e qualquer cliente já cadastrado)
INSERT INTO public.tenant_enabled_pages (tenant_id, page_path)
SELECT t.id, p.page_path
FROM public.tenants t
CROSS JOIN (VALUES
  ('/apps'),
  ('/aquisicao/dashboard'),
  ('/aquisicao/funil'),
  ('/aquisicao/insights'),
  ('/aquisicao/financeiro'),
  ('/aquisicao/legado/funil'),
  ('/aquisicao/legado/meta'),
  ('/comercial/leads'),
  ('/comercial/oportunidades'),
  ('/comercial/onboarding'),
  ('/comercial/accounts'),
  ('/comercial/cobrancas')
) AS p(page_path)
ON CONFLICT DO NOTHING;

-- Storage policy: super_admin_v4 pode upload em avatars/tenant-logos/*
CREATE POLICY "Super admin upload tenant logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'tenant-logos'
  AND has_role(auth.uid(), 'super_admin_v4'::app_role)
);

CREATE POLICY "Super admin update tenant logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'tenant-logos'
  AND has_role(auth.uid(), 'super_admin_v4'::app_role)
);