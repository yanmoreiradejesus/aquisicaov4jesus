-- 1. Add new columns to crm_oportunidades
ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS contrato_url text,
  ADD COLUMN IF NOT EXISTS oportunidades_monetizacao text,
  ADD COLUMN IF NOT EXISTS grau_exigencia text,
  ADD COLUMN IF NOT EXISTS info_deal text;

-- 2. Create private bucket for signed contracts
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-assinados', 'contratos-assinados', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS policies on storage.objects for the bucket
CREATE POLICY "Authenticated insert contratos-assinados"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contratos-assinados');

CREATE POLICY "Authenticated read contratos-assinados"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'contratos-assinados');

CREATE POLICY "Admin delete contratos-assinados"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'contratos-assinados' AND public.has_role(auth.uid(), 'admin'));