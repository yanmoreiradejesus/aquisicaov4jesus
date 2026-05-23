
-- Create private bucket for journey PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('account-journeys', 'account-journeys', false)
ON CONFLICT (id) DO NOTHING;

-- Read: usuários autenticados podem ler PDFs do seu tenant (path = tenant_id/account_id/...)
CREATE POLICY "Read journey PDFs same tenant"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'account-journeys'
  AND (storage.foldername(name))[1]::uuid = public.current_tenant_id()
);

-- Insert/Update/Delete são feitos só pela service role da edge function;
-- ainda assim, autorizo admins do tenant a apagar.
CREATE POLICY "Admins delete journey PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'account-journeys'
  AND (storage.foldername(name))[1]::uuid = public.current_tenant_id()
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'super_admin_v4'::public.app_role))
);
