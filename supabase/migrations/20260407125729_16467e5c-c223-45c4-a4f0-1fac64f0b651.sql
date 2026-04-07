CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_first_user boolean;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first_user;
  
  INSERT INTO public.profiles (id, email, full_name, approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    is_first_user
  );
  
  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
    INSERT INTO public.user_page_access (user_id, page_path)
    VALUES (NEW.id, '/'), (NEW.id, '/insights'), (NEW.id, '/admin'), (NEW.id, '/financeiro'), (NEW.id, '/dashboard-comercial'), (NEW.id, '/mix-compra');
  END IF;
  
  RETURN NEW;
END;
$function$;