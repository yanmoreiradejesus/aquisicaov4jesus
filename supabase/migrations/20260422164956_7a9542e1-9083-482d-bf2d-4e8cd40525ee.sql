-- Tabela de mapeamento operador VoIP -> usuário do CRM
CREATE TABLE public.voip_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'api4com',
  operador_id TEXT NOT NULL,
  apelido TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, operador_id)
);

CREATE INDEX idx_voip_accounts_user ON public.voip_accounts(user_id);
CREATE INDEX idx_voip_accounts_lookup ON public.voip_accounts(provider, operador_id) WHERE ativo = true;

ALTER TABLE public.voip_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own voip accounts"
  ON public.voip_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own voip accounts"
  ON public.voip_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users update own voip accounts"
  ON public.voip_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own voip accounts"
  ON public.voip_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_voip_accounts_updated_at
  BEFORE UPDATE ON public.voip_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Vincula evento de chamada ao usuário responsável (resolvido pelo webhook)
ALTER TABLE public.crm_call_events
  ADD COLUMN user_id UUID;

CREATE INDEX idx_crm_call_events_user ON public.crm_call_events(user_id);