INSERT INTO storage.buckets (id, name, public) VALUES ('call-recordings', 'call-recordings', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read call recordings" ON storage.objects FOR SELECT USING (bucket_id = 'call-recordings');
CREATE POLICY "Authenticated upload call recordings" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'call-recordings');
CREATE POLICY "Admin manage call recordings" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'call-recordings' AND has_role(auth.uid(), 'admin'::app_role));