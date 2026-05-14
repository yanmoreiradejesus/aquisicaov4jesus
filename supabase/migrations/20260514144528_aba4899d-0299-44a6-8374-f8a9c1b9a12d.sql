-- 1) Quem tinha acesso ao /aquisicao/funil agora também ganha /aquisicao/legado/funil
INSERT INTO public.user_page_access (user_id, page_path)
SELECT user_id, '/aquisicao/legado/funil'
FROM public.user_page_access
WHERE page_path = '/aquisicao/funil'
ON CONFLICT DO NOTHING;

-- 2) Quem tinha acesso ao /aquisicao/meta agora ganha /aquisicao/legado/meta
INSERT INTO public.user_page_access (user_id, page_path)
SELECT user_id, '/aquisicao/legado/meta'
FROM public.user_page_access
WHERE page_path = '/aquisicao/meta'
ON CONFLICT DO NOTHING;

-- 3) Atualiza handle_new_user para o primeiro usuário receber também as páginas legado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, approved)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    FALSE
  );

  SELECT COUNT(*) = 1 INTO is_first_user FROM public.profiles;

  IF is_first_user THEN
    UPDATE public.profiles SET approved = TRUE WHERE id = NEW.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_page_access (user_id, page_path) VALUES
      (NEW.id, '/aquisicao/funil'),
      (NEW.id, '/aquisicao/dashboard'),
      (NEW.id, '/aquisicao/insights'),
      (NEW.id, '/aquisicao/financeiro'),
      (NEW.id, '/aquisicao/legado/funil'),
      (NEW.id, '/aquisicao/legado/meta');
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Templates de role: replicar acesso para versões legado
UPDATE public.role_access_templates
SET pages = (
  SELECT ARRAY(
    SELECT DISTINCT unnest(
      pages
      || CASE WHEN '/aquisicao/funil' = ANY(pages) THEN ARRAY['/aquisicao/legado/funil']::text[] ELSE ARRAY[]::text[] END
      || CASE WHEN '/aquisicao/meta' = ANY(pages) THEN ARRAY['/aquisicao/legado/meta']::text[] ELSE ARRAY[]::text[] END
    )
  )
)
WHERE '/aquisicao/funil' = ANY(pages) OR '/aquisicao/meta' = ANY(pages);
