DROP POLICY IF EXISTS "Manager or admin update accounts" ON public.accounts;
CREATE POLICY "Approved users update accounts"
ON public.accounts
FOR UPDATE
TO authenticated
USING (is_approved(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));