CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_first_user BOOLEAN;
  v_tenant UUID;
  v_cargo TEXT;
  v_departamento TEXT;
BEGIN
  BEGIN
    v_tenant := NULLIF(NEW.raw_user_meta_data->>'tenant_id','')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tenant := NULL;
  END;

  IF v_tenant IS NULL THEN
    SELECT id INTO v_tenant FROM public.tenants WHERE client_slug = 'jesus' LIMIT 1;
  END IF;

  v_cargo := NULLIF(NEW.raw_user_meta_data->>'cargo','');
  v_departamento := NULLIF(NEW.raw_user_meta_data->>'departamento','');

  INSERT INTO public.profiles (id, email, full_name, approved, tenant_id, cargo, departamento)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', FALSE, v_tenant, v_cargo, v_departamento);

  SELECT COUNT(*) = 1 INTO is_first_user FROM public.profiles;

  IF is_first_user THEN
    UPDATE public.profiles SET approved = TRUE WHERE id = NEW.id;
    INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (NEW.id, 'admin', v_tenant);
    INSERT INTO public.user_page_access (user_id, page_path, tenant_id) VALUES
      (NEW.id, '/aquisicao/funil', v_tenant),
      (NEW.id, '/aquisicao/dashboard', v_tenant),
      (NEW.id, '/aquisicao/insights', v_tenant),
      (NEW.id, '/aquisicao/financeiro', v_tenant),
      (NEW.id, '/aquisicao/legado/funil', v_tenant),
      (NEW.id, '/aquisicao/legado/meta', v_tenant);
  END IF;

  RETURN NEW;
END;
$function$;