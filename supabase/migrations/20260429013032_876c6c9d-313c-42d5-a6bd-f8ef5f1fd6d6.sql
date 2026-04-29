-- Function to auto-mark onboarding as 'atrasada' after 3 days in 'entrada'
CREATE OR REPLACE FUNCTION public.auto_mark_onboarding_atrasada()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.accounts
  SET onboarding_status = 'atrasada'
  WHERE onboarding_status = 'entrada'
    AND created_at < (now() - interval '3 days');
END;
$$;

-- Enable pg_cron if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily check at 03:00 UTC
SELECT cron.schedule(
  'auto-mark-onboarding-atrasada-daily',
  '0 3 * * *',
  $$ SELECT public.auto_mark_onboarding_atrasada(); $$
);