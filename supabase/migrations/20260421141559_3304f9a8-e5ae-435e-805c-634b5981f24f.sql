-- Atualizar política de DELETE para permitir qualquer usuário autenticado excluir oportunidades
DROP POLICY IF EXISTS "Admin delete oport" ON public.crm_oportunidades;

CREATE POLICY "Authenticated users can delete oport" 
ON public.crm_oportunidades 
FOR DELETE 
TO authenticated 
USING (true);