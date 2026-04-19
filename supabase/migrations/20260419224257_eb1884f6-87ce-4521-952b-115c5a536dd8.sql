-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'copilot-attachments',
  'copilot-attachments',
  false,
  20971520,
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users upload own copilot attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'copilot-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users read own copilot attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'copilot-attachments'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Users update own copilot attachments"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'copilot-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own copilot attachments"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'copilot-attachments'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
);

-- Attachments table
CREATE TABLE public.crm_copilot_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  oportunidade_id UUID NOT NULL,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT,
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_copilot_attachments_oportunidade ON public.crm_copilot_attachments(oportunidade_id);

ALTER TABLE public.crm_copilot_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read copilot attachments"
ON public.crm_copilot_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users insert own copilot attachments rows"
ON public.crm_copilot_attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner or admin delete copilot attachments rows"
ON public.crm_copilot_attachments FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));