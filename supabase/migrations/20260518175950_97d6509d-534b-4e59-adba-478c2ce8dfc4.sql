-- Habilita a página Meta (CRM) para todos os tenants que já têm o Funil habilitado
INSERT INTO public.tenant_enabled_pages (tenant_id, page_path)
SELECT DISTINCT tenant_id, '/aquisicao/meta'
FROM public.tenant_enabled_pages
WHERE page_path = '/aquisicao/funil'
ON CONFLICT DO NOTHING;

-- Concede acesso individual à nova página a todos os usuários que já têm acesso ao Funil
INSERT INTO public.user_page_access (user_id, page_path, tenant_id)
SELECT DISTINCT user_id, '/aquisicao/meta', tenant_id
FROM public.user_page_access
WHERE page_path = '/aquisicao/funil'
ON CONFLICT DO NOTHING;