-- Create table for monthly goals
CREATE TABLE IF NOT EXISTS public.monthly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2100),
  revenue_goal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  contracts_goal INTEGER NOT NULL DEFAULT 0,
  mrr_goal DECIMAL(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- Enable RLS
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (public dashboard)
CREATE POLICY "Allow all operations on monthly_goals"
ON public.monthly_goals
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_monthly_goals_updated_at
BEFORE UPDATE ON public.monthly_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();