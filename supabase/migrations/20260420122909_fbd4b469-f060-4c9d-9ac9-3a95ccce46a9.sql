-- 1. Colunas
ALTER TABLE public.crm_call_events
  ADD COLUMN IF NOT EXISTS transcricao TEXT,
  ADD COLUMN IF NOT EXISTS transcricao_status TEXT,
  ADD COLUMN IF NOT EXISTS transcricao_error TEXT;

-- 2. Garantir extensões para chamada HTTP assíncrona
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 3. Função que dispara a edge function quando gravacao_url é preenchida
CREATE OR REPLACE FUNCTION public.trigger_transcribe_call_recording()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT;
BEGIN
  -- Só age se tem gravação nova e ainda não foi transcrita/processada
  IF NEW.gravacao_url IS NOT NULL
     AND (OLD.gravacao_url IS DISTINCT FROM NEW.gravacao_url OR TG_OP = 'INSERT')
     AND NEW.transcricao IS NULL
     AND (NEW.transcricao_status IS NULL OR NEW.transcricao_status = 'erro')
  THEN
    -- Marca como pendente
    NEW.transcricao_status := 'pendente';

    v_url := 'https://edctpsdcrivpxynfxpef.supabase.co/functions/v1/transcribe-call-recording';

    PERFORM net.http_post(
      url := v_url,
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('event_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_transcribe_call_recording ON public.crm_call_events;
CREATE TRIGGER trg_transcribe_call_recording
BEFORE INSERT OR UPDATE OF gravacao_url
ON public.crm_call_events
FOR EACH ROW
EXECUTE FUNCTION public.trigger_transcribe_call_recording();

-- 5. Permitir UPDATE pelo service_role (já tem por padrão) e admin (já existe)
-- Permitir UPDATE para a função poder atualizar via service role - já garantido
