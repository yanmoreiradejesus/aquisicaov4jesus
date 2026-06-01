-- Drop old composite unique index/constraint (email + data_criacao_origem)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.crm_leads'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.crm_leads DROP CONSTRAINT %I', r.conname);
  END LOOP;
  FOR r IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'crm_leads'
      AND indexname LIKE '%email%data_criacao%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', r.indexname);
  END LOOP;
END $$;

-- Unique by email (case-insensitive) per tenant
CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_tenant_email_uidx
  ON public.crm_leads (tenant_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

-- Unique by normalized phone per tenant
CREATE UNIQUE INDEX IF NOT EXISTS crm_leads_tenant_phone_uidx
  ON public.crm_leads (tenant_id, public.normalize_phone_br(telefone))
  WHERE telefone IS NOT NULL AND public.normalize_phone_br(telefone) <> '';