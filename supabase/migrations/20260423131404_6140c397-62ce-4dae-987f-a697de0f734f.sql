DROP POLICY IF EXISTS "Author or admin delete atividades" ON public.crm_atividades;
DROP POLICY IF EXISTS "Author or admin update atividades" ON public.crm_atividades;

CREATE POLICY "Approved users delete atividades"
ON public.crm_atividades
FOR DELETE
TO authenticated
USING (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users update atividades"
ON public.crm_atividades
FOR UPDATE
TO authenticated
USING (public.is_approved(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));