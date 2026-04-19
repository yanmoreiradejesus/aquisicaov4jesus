-- Tabela para armazenar tokens OAuth do Google Calendar por usuário
CREATE TABLE public.user_google_tokens (
  user_id UUID NOT NULL PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  access_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  email_google TEXT,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own google token"
  ON public.user_google_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own google token"
  ON public.user_google_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own google token"
  ON public.user_google_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own google token"
  ON public.user_google_tokens FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_user_google_tokens_updated_at
  BEFORE UPDATE ON public.user_google_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar colunas de Google Calendar event no crm_leads
ALTER TABLE public.crm_leads
  ADD COLUMN google_event_id TEXT,
  ADD COLUMN google_event_link TEXT;