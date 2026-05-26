
CREATE OR REPLACE FUNCTION public.trigger_transcribe_call_recording()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_url TEXT;
BEGIN
  IF NEW.gravacao_url IS NOT NULL
     AND (
       OLD.gravacao_url IS DISTINCT FROM NEW.gravacao_url
       OR OLD.duracao_seg IS DISTINCT FROM NEW.duracao_seg
       OR TG_OP = 'INSERT'
     )
     AND NEW.transcricao IS NULL
     AND (NEW.transcricao_status IS NULL OR NEW.transcricao_status IN ('erro','sem_audio'))
     AND COALESCE(NEW.duracao_seg, 0) >= 10
  THEN
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
$function$;
