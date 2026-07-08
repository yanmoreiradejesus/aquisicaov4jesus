
CREATE POLICY "projeto-anexos read tenant"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND (storage.foldername(name))[1]::uuid = public.current_tenant_id()
);

CREATE POLICY "projeto-anexos insert tenant"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'projeto-anexos'
  AND (storage.foldername(name))[1]::uuid = public.current_tenant_id()
);

CREATE POLICY "projeto-anexos delete tenant"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'projeto-anexos'
  AND (storage.foldername(name))[1]::uuid = public.current_tenant_id()
);
