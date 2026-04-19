-- 1. Adicionar novos valores ao enum (precisa ser em transação separada antes de usar)
ALTER TYPE public.oportunidade_etapa ADD VALUE IF NOT EXISTS 'contrato';
ALTER TYPE public.oportunidade_etapa ADD VALUE IF NOT EXISTS 'fechado_ganho';
ALTER TYPE public.oportunidade_etapa ADD VALUE IF NOT EXISTS 'fechado_perdido';

-- 2. Atualizar função auto_create_account_and_cobrancas para usar novo enum
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

    INSERT INTO public.accounts (oportunidade_id, cliente_nome, account_manager_id, data_inicio_contrato)
    VALUES (NEW.id, v_cliente, NEW.responsavel_id, COALESCE(NEW.data_fechamento_real::DATE, CURRENT_DATE))
    RETURNING id INTO v_account_id;

    IF COALESCE(NEW.valor_ef, 0) > 0 THEN
      INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total)
      VALUES (v_account_id, NEW.id, NEW.valor_ef, CURRENT_DATE, 'ef', 1, 1);
    END IF;

    IF COALESCE(NEW.valor_fee, 0) > 0 THEN
      FOR i IN 1..12 LOOP
        INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total)
        VALUES (v_account_id, NEW.id, NEW.valor_fee, (CURRENT_DATE + (i || ' months')::interval)::DATE, 'fee_recorrente', i, 12);
      END LOOP;
    END IF;

    IF NEW.data_fechamento_real IS NULL THEN
      UPDATE public.crm_oportunidades SET data_fechamento_real = now() WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Anexar triggers que estavam soltos
DROP TRIGGER IF EXISTS trg_auto_create_oportunidade ON public.crm_leads;
CREATE TRIGGER trg_auto_create_oportunidade
  AFTER UPDATE OF etapa ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_oportunidade();

DROP TRIGGER IF EXISTS trg_log_lead_etapa_change ON public.crm_leads;
CREATE TRIGGER trg_log_lead_etapa_change
  AFTER UPDATE OF etapa ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_etapa_change();

DROP TRIGGER IF EXISTS trg_log_lead_creation ON public.crm_leads;
CREATE TRIGGER trg_log_lead_creation
  AFTER INSERT ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_creation();

DROP TRIGGER IF EXISTS trg_auto_create_account_and_cobrancas ON public.crm_oportunidades;
CREATE TRIGGER trg_auto_create_account_and_cobrancas
  AFTER UPDATE OF etapa ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_account_and_cobrancas();

-- updated_at triggers
DROP TRIGGER IF EXISTS trg_crm_leads_updated_at ON public.crm_leads;
CREATE TRIGGER trg_crm_leads_updated_at
  BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_crm_oportunidades_updated_at ON public.crm_oportunidades;
CREATE TRIGGER trg_crm_oportunidades_updated_at
  BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_cobrancas_updated_at ON public.cobrancas;
CREATE TRIGGER trg_cobrancas_updated_at
  BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();