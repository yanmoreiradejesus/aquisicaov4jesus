CREATE OR REPLACE FUNCTION public.list_tenant_receitas_users()
RETURNS TABLE(id uuid, full_name text, email text, cargo text, departamento text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.cargo, p.departamento
  FROM public.profiles p
  WHERE p.tenant_id = public.current_tenant_id()
    AND p.approved = true
    AND p.departamento = 'Receitas'
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.list_tenant_receitas_users() TO authenticated;