
DROP TRIGGER IF EXISTS trg_transcribe_call_recording ON public.crm_call_events;
CREATE TRIGGER trg_transcribe_call_recording
  BEFORE INSERT OR UPDATE OF gravacao_url, duracao_seg
  ON public.crm_call_events
  FOR EACH ROW EXECUTE FUNCTION public.trigger_transcribe_call_recording();
