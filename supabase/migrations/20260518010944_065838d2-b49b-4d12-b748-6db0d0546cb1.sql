
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_tenant_id uuid;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(active_tenant_id, tenant_id) FROM public.profiles WHERE id = auth.uid()
$$;

-- Permite que usuário comum altere apenas active_tenant_id no próprio perfil
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
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar cargo, departamento, email, tenant ou status de aprovação';
  END IF;

  RETURN NEW;
END;
$$;
