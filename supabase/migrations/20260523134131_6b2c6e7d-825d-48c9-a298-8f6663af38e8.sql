
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS closer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_crm_leads_closer ON public.crm_leads(closer_id);

ALTER TABLE public.crm_oportunidades ADD COLUMN IF NOT EXISTS closer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_crm_oport_closer ON public.crm_oportunidades(closer_id);

-- Backfill: oportunidades existentes — copiar responsavel_id (que vinha sendo usado como closer) para closer_id
UPDATE public.crm_oportunidades SET closer_id = responsavel_id WHERE closer_id IS NULL AND responsavel_id IS NOT NULL;

-- Backfill: accounts — mover growth_class_responsavel_id para account_manager_id quando vazio
UPDATE public.accounts
  SET account_manager_id = growth_class_responsavel_id
  WHERE account_manager_id IS NULL AND growth_class_responsavel_id IS NOT NULL;

ALTER TABLE public.accounts DROP COLUMN IF EXISTS growth_class_responsavel_id;

-- Atualizar trigger auto_create_oportunidade para copiar closer_id
CREATE OR REPLACE FUNCTION public.auto_create_oportunidade()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.etapa = 'reuniao_realizada' AND (OLD.etapa IS DISTINCT FROM 'reuniao_realizada') THEN
    IF NOT EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE lead_id = NEW.id) THEN
      INSERT INTO public.crm_oportunidades (lead_id, nome_oportunidade, etapa, responsavel_id, closer_id, data_proposta, tenant_id)
      VALUES (
        NEW.id,
        COALESCE(NEW.empresa, NEW.nome),
        'proposta',
        COALESCE(NEW.closer_id, NEW.responsavel_id),
        COALESCE(NEW.closer_id, NEW.responsavel_id),
        now(),
        NEW.tenant_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Atualizar auto_create_account_and_cobrancas: account_manager fica vazio (preenchido manualmente na Growth Class)
CREATE OR REPLACE FUNCTION public.auto_create_account_and_cobrancas()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_account_id UUID;
  v_cliente TEXT;
  v_lead RECORD;
  i INTEGER;
BEGIN
  IF NEW.etapa = 'fechado_ganho' AND (OLD.etapa IS DISTINCT FROM 'fechado_ganho') THEN
    IF EXISTS (SELECT 1 FROM public.accounts WHERE oportunidade_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT empresa, nome INTO v_lead FROM public.crm_leads WHERE id = NEW.lead_id;
    v_cliente := COALESCE(v_lead.empresa, v_lead.nome, NEW.nome_oportunidade);

    INSERT INTO public.accounts (oportunidade_id, cliente_nome, account_manager_id, data_inicio_contrato, tenant_id)
    VALUES (NEW.id, v_cliente, NULL, COALESCE(NEW.data_fechamento_real::DATE, CURRENT_DATE), NEW.tenant_id)
    RETURNING id INTO v_account_id;

    IF COALESCE(NEW.valor_ef, 0) > 0 THEN
      INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total, tenant_id)
      VALUES (v_account_id, NEW.id, NEW.valor_ef, CURRENT_DATE, 'ef', 1, 1, NEW.tenant_id);
    END IF;

    IF COALESCE(NEW.valor_fee, 0) > 0 THEN
      FOR i IN 1..12 LOOP
        INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total, tenant_id)
        VALUES (v_account_id, NEW.id, NEW.valor_fee, (CURRENT_DATE + (i || ' months')::interval)::DATE, 'fee_recorrente', i, 12, NEW.tenant_id);
      END LOOP;
    END IF;

    IF NEW.data_fechamento_real IS NULL THEN
      UPDATE public.crm_oportunidades SET data_fechamento_real = now() WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
