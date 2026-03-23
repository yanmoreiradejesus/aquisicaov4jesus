
-- Fix monthly_goals: restrict to authenticated users
DROP POLICY IF EXISTS "Allow all operations on monthly_goals" ON public.monthly_goals;

CREATE POLICY "Authenticated users can read monthly_goals" ON public.monthly_goals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage monthly_goals" ON public.monthly_goals
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
