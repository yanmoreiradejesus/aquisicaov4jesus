-- Dropar trigger e função com CASCADE para evitar erro de dependência
DROP TRIGGER IF EXISTS prevent_sensitive_profile_changes ON public.profiles;
DROP FUNCTION IF EXISTS public.prevent_sensitive_profile_changes() CASCADE;

-- Recriar a função com verificação melhorada
CREATE OR REPLACE FUNCTION public.prevent_sensitive_profile_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se é admin, permite tudo
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Se auth.uid() é NULL (service role/migration), permite
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Usuário comum tentando alterar campos sensíveis
  IF NEW.approved IS DISTINCT FROM OLD.approved
     OR NEW.cargo IS DISTINCT FROM OLD.cargo
     OR NEW.departamento IS DISTINCT FROM OLD.departamento
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar cargo, departamento, email ou status de aprovação';
  END IF;

  RETURN NEW;
END;
$$;

-- Recriar o trigger
CREATE TRIGGER prevent_sensitive_profile_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_sensitive_profile_changes();

-- Limpar templates antigos e inserir novos
TRUNCATE TABLE public.role_access_templates;

INSERT INTO public.role_access_templates (cargo, pages, updated_at) VALUES
-- Receitas
('SDR', ARRAY['/comercial/leads'], now()),
('Closer', ARRAY['/comercial/leads', '/comercial/oportunidades'], now()),
('BDR', ARRAY['/comercial/leads', '/comercial/oportunidades'], now()),
('Líder de Expansão', ARRAY['/comercial/leads', '/comercial/oportunidades', '/comercial/accounts', '/comercial/cobrancas'], now()),

-- PE&G
('Coordenador de PE&G', ARRAY['/aquisicao/dashboard', '/aquisicao/funil', '/aquisicao/insights', '/aquisicao/meta', '/aquisicao/financeiro', '/aquisicao/mix'], now()),
('Account Manager', ARRAY['/comercial/accounts', '/comercial/cobrancas'], now()),
('Gestor de Tráfego', ARRAY['/aquisicao/dashboard', '/aquisicao/funil', '/aquisicao/insights', '/aquisicao/meta'], now()),
('Designer', ARRAY['/aquisicao/dashboard', '/aquisicao/insights'], now()),
('Copywriter', ARRAY['/aquisicao/dashboard', '/aquisicao/insights'], now()),
('Social Media', ARRAY['/aquisicao/dashboard', '/aquisicao/insights'], now()),
('Consultor', ARRAY['/comercial/leads', '/comercial/oportunidades'], now()),
('Analista de Tech', ARRAY['/aquisicao/dashboard', '/aquisicao/funil', '/aquisicao/insights', '/aquisicao/financeiro'], now()),

-- ADM
('Coordenadora ADM', ARRAY['/aquisicao/dashboard', '/aquisicao/financeiro', '/admin'], now()),
('HRBP', ARRAY['/admin'], now()),
('Analista Financeira', ARRAY['/aquisicao/financeiro'], now());

-- Atualizar departamentos dos profiles existentes
UPDATE public.profiles 
SET departamento = CASE 
  WHEN cargo IN ('SDR', 'Closer', 'BDR', 'Líder de Expansão', 'Account Manager', 'Consultor') THEN 'Receitas'
  WHEN cargo IN ('Coordenador de PE&G', 'Gestor de Tráfego', 'Designer', 'Copywriter', 'Social Media', 'Analista de Tech') THEN 'PE&G'
  WHEN cargo IN ('Coordenadora ADM', 'HRBP', 'Analista Financeira') THEN 'ADM'
  ELSE 'Outro'
END
WHERE departamento IS NULL OR departamento = 'Outro';