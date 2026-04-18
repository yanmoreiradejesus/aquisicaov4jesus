-- Migrate existing user_page_access to /aquisicao/* prefixed paths
-- Old paths: /, /insights, /mix-compra, /financeiro
-- New paths: /aquisicao/funil, /aquisicao/insights, /aquisicao/meta, /aquisicao/financeiro
-- Note: /dashboard-comercial → /aquisicao/dashboard

UPDATE public.user_page_access SET page_path = '/aquisicao/funil'      WHERE page_path = '/';
UPDATE public.user_page_access SET page_path = '/aquisicao/insights'   WHERE page_path = '/insights';
UPDATE public.user_page_access SET page_path = '/aquisicao/meta'       WHERE page_path = '/mix-compra';
UPDATE public.user_page_access SET page_path = '/aquisicao/financeiro' WHERE page_path = '/financeiro';
UPDATE public.user_page_access SET page_path = '/aquisicao/dashboard'  WHERE page_path = '/dashboard-comercial';

-- Update handle_new_user function to grant access to the new aquisicao paths for the first user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, approved)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    FALSE
  );

  -- Check if this is the first user
  SELECT COUNT(*) = 1 INTO is_first_user FROM public.profiles;

  IF is_first_user THEN
    -- Auto-approve first user, make admin, grant all aquisicao pages
    UPDATE public.profiles SET approved = TRUE WHERE id = NEW.id;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_page_access (user_id, page_path) VALUES
      (NEW.id, '/aquisicao/funil'),
      (NEW.id, '/aquisicao/dashboard'),
      (NEW.id, '/aquisicao/insights'),
      (NEW.id, '/aquisicao/meta'),
      (NEW.id, '/aquisicao/financeiro');
  END IF;

  RETURN NEW;
END;
$$;