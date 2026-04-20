-- 1. Adicionar colunas em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Tabela de templates de acesso por cargo
CREATE TABLE IF NOT EXISTS public.role_access_templates (
  cargo text PRIMARY KEY,
  pages text[] NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.role_access_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read templates"
ON public.role_access_templates
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage templates"
ON public.role_access_templates
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Templates iniciais
INSERT INTO public.role_access_templates (cargo, pages) VALUES
  ('SDR', ARRAY['/comercial/leads']),
  ('Closer', ARRAY['/comercial/leads','/comercial/oportunidades']),
  ('CS', ARRAY['/comercial/oportunidades']),
  ('Gestor', ARRAY['/comercial/leads','/comercial/oportunidades','/aquisicao/funil','/aquisicao/dashboard','/aquisicao/insights','/aquisicao/meta','/aquisicao/financeiro'])
ON CONFLICT (cargo) DO NOTHING;

-- 3. Permitir que usuário atualize SEU próprio perfil (campos pessoais)
-- Mantém a policy de admin existente; adiciona uma para o próprio usuário
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- 4. Trigger que impede usuário comum de mudar campos sensíveis (approved, cargo, departamento, email)
CREATE OR REPLACE FUNCTION public.prevent_sensitive_profile_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.cargo IS DISTINCT FROM OLD.cargo
     OR NEW.departamento IS DISTINCT FROM OLD.departamento
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar cargo, departamento, email ou status de aprovação';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_sensitive_changes ON public.profiles;
CREATE TRIGGER profiles_prevent_sensitive_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_sensitive_profile_changes();

-- 5. Bucket de avatars (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket avatars
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;
CREATE POLICY "Avatars are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);