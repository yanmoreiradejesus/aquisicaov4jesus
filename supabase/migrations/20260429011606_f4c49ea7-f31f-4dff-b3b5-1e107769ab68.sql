-- Add transcription field for Growth Class meeting
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS growth_class_transcricao_reuniao text;

-- Trigger: enqueue Pre-GC generation after account creation
CREATE OR REPLACE FUNCTION public.trigger_generate_pre_gc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_url TEXT;
BEGIN
  IF NEW.pre_growth_class_relatorio IS NULL THEN
    v_url := 'https://edctpsdcrivpxynfxpef.supabase.co/functions/v1/auto-generate-pre-gc';
    PERFORM net.http_post(
      url := v_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('account_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_generate_pre_gc ON public.accounts;
CREATE TRIGGER trg_accounts_generate_pre_gc
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_generate_pre_gc();