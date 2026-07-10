INSERT INTO public.tenant_enabled_pages (tenant_id, page_path)
SELECT t.id, p.path
FROM public.tenants t
CROSS JOIN (VALUES ('/admin/people'), ('/admin/financeiro')) AS p(path)
WHERE t.status = 'active'
ON CONFLICT DO NOTHING;