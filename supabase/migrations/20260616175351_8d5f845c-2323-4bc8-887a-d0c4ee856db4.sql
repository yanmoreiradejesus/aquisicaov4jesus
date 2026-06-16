ALTER TABLE public.account_scope
  ADD COLUMN IF NOT EXISTS contratado boolean NOT NULL DEFAULT false;