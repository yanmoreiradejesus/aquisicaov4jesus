-- Add conversion rate columns to monthly_goals table
ALTER TABLE public.monthly_goals 
ADD COLUMN IF NOT EXISTS mql_to_cr_rate NUMERIC DEFAULT 80,
ADD COLUMN IF NOT EXISTS cr_to_ra_rate NUMERIC DEFAULT 67,
ADD COLUMN IF NOT EXISTS ra_to_rr_rate NUMERIC DEFAULT 81,
ADD COLUMN IF NOT EXISTS rr_to_ass_rate NUMERIC DEFAULT 38;