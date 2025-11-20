-- Add CPMQL target and investment target columns to monthly_goals
ALTER TABLE public.monthly_goals
ADD COLUMN IF NOT EXISTS cpmql_target numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS investment_target numeric DEFAULT 0;