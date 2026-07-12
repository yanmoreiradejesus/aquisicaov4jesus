
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'aquisicao',
  ADD COLUMN IF NOT EXISTS expansao_id uuid REFERENCES public.crm_expansoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_expansao_id ON public.accounts(expansao_id);
