-- Replace overly permissive DELETE policy on crm_oportunidades with admin-only
DROP POLICY IF EXISTS "Authenticated users can delete oport" ON public.crm_oportunidades;

CREATE POLICY "Admin delete oport"
ON public.crm_oportunidades
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));