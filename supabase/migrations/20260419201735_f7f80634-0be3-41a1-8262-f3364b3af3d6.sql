ALTER TYPE public.oportunidade_etapa ADD VALUE IF NOT EXISTS 'follow_infinito';

ALTER TABLE public.crm_oportunidades
  ADD COLUMN IF NOT EXISTS transcricao_reuniao text,
  ADD COLUMN IF NOT EXISTS temperatura text;