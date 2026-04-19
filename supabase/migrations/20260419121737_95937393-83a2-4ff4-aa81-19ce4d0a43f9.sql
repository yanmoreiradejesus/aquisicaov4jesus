ALTER TABLE public.crm_leads 
  ADD COLUMN IF NOT EXISTS temperatura text,
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS site text;