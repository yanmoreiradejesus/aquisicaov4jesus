CREATE TABLE public.mix_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  investment_target NUMERIC DEFAULT 45000,
  leads_target INTEGER DEFAULT 52,
  cpmql_target NUMERIC DEFAULT 865,
  ef_target NUMERIC DEFAULT 157000,
  ef_avg NUMERIC DEFAULT 22392,
  cr_rate NUMERIC DEFAULT 0.76,
  ra_rate NUMERIC DEFAULT 0.68,
  rr_rate NUMERIC DEFAULT 0.78,
  ass_rate NUMERIC DEFAULT 0.34,
  pace_q1_pct NUMERIC DEFAULT 0.70,
  pace_q1_dia_limite INTEGER DEFAULT 15,
  tier_mix JSONB DEFAULT '{}',
  periodo_mix JSONB DEFAULT '{}',
  canal_mix JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(month, year)
);

ALTER TABLE public.mix_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read mix_goals" ON public.mix_goals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage mix_goals" ON public.mix_goals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_mix_goals_updated_at
  BEFORE UPDATE ON public.mix_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();