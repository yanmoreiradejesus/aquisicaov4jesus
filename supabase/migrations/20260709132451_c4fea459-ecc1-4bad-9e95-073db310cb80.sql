
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS growth_class_transcricao text;

INSERT INTO public.tenant_enabled_pages (tenant_id, page_path)
SELECT id, '/comercial/projetos/cadastro' FROM public.tenants WHERE active = true
ON CONFLICT DO NOTHING;

INSERT INTO public.user_page_access (user_id, page_path, tenant_id)
SELECT upa.user_id, '/comercial/projetos/cadastro', upa.tenant_id
FROM public.user_page_access upa
WHERE upa.page_path = '/comercial/projetos'
ON CONFLICT DO NOTHING;
