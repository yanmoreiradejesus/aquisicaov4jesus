ALTER TABLE public.crm_call_events
  ADD COLUMN IF NOT EXISTS spiced text,
  ADD COLUMN IF NOT EXISTS spiced_status text,
  ADD COLUMN IF NOT EXISTS spiced_error text;