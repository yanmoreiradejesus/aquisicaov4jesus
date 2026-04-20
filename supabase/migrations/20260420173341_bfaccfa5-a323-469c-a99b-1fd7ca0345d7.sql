-- Permitir que qualquer usuário autenticado e aprovado movimente cards
-- de leads e oportunidades (mover etapa, editar dados etc).

-- Função auxiliar: usuário está aprovado?
CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND approved = true
  )
$$;

-- crm_leads UPDATE
DROP POLICY IF EXISTS "Owner or admin update leads" ON public.crm_leads;
CREATE POLICY "Approved users update leads"
ON public.crm_leads
FOR UPDATE
TO authenticated
USING (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- crm_oportunidades UPDATE
DROP POLICY IF EXISTS "Owner or admin update oport" ON public.crm_oportunidades;
CREATE POLICY "Approved users update oport"
ON public.crm_oportunidades
FOR UPDATE
TO authenticated
USING (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));