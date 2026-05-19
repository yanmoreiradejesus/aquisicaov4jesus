CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.has_role(auth.uid(), 'super_admin_v4'::app_role) THEN coalesce(active_tenant_id, tenant_id)
    ELSE tenant_id
  END
  FROM public.profiles
  WHERE id = auth.uid()
$$;

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
    v_tenant := public.current_tenant_id();

    IF v_tenant IS NOT NULL THEN
      NEW.tenant_id := v_tenant;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_sensitive_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role)
     OR public.has_role(auth.uid(), 'super_admin_v4'::app_role) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.cargo IS DISTINCT FROM OLD.cargo
     OR NEW.departamento IS DISTINCT FROM OLD.departamento
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.active_tenant_id IS DISTINCT FROM OLD.active_tenant_id THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar cargo, departamento, email, tenant, tenant ativo ou status de aprovação';
  END IF;

  RETURN NEW;
END;
$$;