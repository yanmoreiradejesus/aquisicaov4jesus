CREATE POLICY "Authenticated can view approved profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (approved = true);