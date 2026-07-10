
-- 1) Novos campos em accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS faturamento_status TEXT NOT NULL DEFAULT 'a_faturar',
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS qtd_parcelas INT,
  ADD COLUMN IF NOT EXISTS modelo_contrato TEXT,
  ADD COLUMN IF NOT EXISTS faturamento_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS faturamento_validated_by UUID;

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_faturamento_status_chk;
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_faturamento_status_chk
  CHECK (faturamento_status IN ('a_faturar','faturado'));

ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_modelo_contrato_chk;
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_modelo_contrato_chk
  CHECK (modelo_contrato IS NULL OR modelo_contrato IN ('escopo_fechado','recorrente'));

-- 2) Trigger atualizado: cria account mas NÃO gera cobranças (aguarda validação do financeiro)
CREATE OR REPLACE FUNCTION public.auto_create_account_and_cobrancas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cliente TEXT;
  v_lead RECORD;
BEGIN
  IF NEW.etapa = 'fechado_ganho' AND (OLD.etapa IS DISTINCT FROM 'fechado_ganho') THEN
    IF EXISTS (SELECT 1 FROM public.accounts WHERE oportunidade_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT empresa, nome INTO v_lead FROM public.crm_leads WHERE id = NEW.lead_id;
    v_cliente := COALESCE(v_lead.empresa, v_lead.nome, NEW.nome_oportunidade);

    INSERT INTO public.accounts (oportunidade_id, cliente_nome, account_manager_id, data_inicio_contrato, tenant_id, faturamento_status)
    VALUES (NEW.id, v_cliente, NULL, COALESCE(NEW.data_fechamento_real::DATE, CURRENT_DATE), NEW.tenant_id, 'a_faturar');

    IF NEW.data_fechamento_real IS NULL THEN
      UPDATE public.crm_oportunidades SET data_fechamento_real = now() WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) RPC de validação: gera cobranças conforme dados do financeiro
CREATE OR REPLACE FUNCTION public.validar_faturamento_account(
  p_account_id UUID,
  p_forma_pagamento TEXT,
  p_qtd_parcelas INT,
  p_modelo_contrato TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_acc RECORD;
  v_op RECORD;
  v_parc_val NUMERIC;
  i INT;
BEGIN
  IF p_qtd_parcelas IS NULL OR p_qtd_parcelas < 1 THEN
    RAISE EXCEPTION 'Quantidade de parcelas inválida';
  END IF;
  IF p_modelo_contrato NOT IN ('escopo_fechado','recorrente') THEN
    RAISE EXCEPTION 'Modelo de contrato inválido';
  END IF;

  SELECT * INTO v_acc FROM public.accounts WHERE id = p_account_id;
  IF v_acc.id IS NULL THEN RAISE EXCEPTION 'Account não encontrada'; END IF;

  SELECT * INTO v_op FROM public.crm_oportunidades WHERE id = v_acc.oportunidade_id;

  -- Limpa cobranças não pagas existentes desta account
  DELETE FROM public.cobrancas
  WHERE account_id = p_account_id
    AND status IN ('pendente','atrasado');

  IF p_modelo_contrato = 'escopo_fechado' THEN
    -- valor total (ef + fee) dividido em qtd_parcelas parcelas mensais
    v_parc_val := ROUND((COALESCE(v_op.valor_ef,0) + COALESCE(v_op.valor_fee,0)) / p_qtd_parcelas, 2);
    IF v_parc_val > 0 THEN
      FOR i IN 1..p_qtd_parcelas LOOP
        INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total, tenant_id, forma_pagamento)
        VALUES (p_account_id, v_op.id, v_parc_val,
                (CURRENT_DATE + ((i-1) || ' months')::interval)::DATE,
                'ef', i, p_qtd_parcelas, v_acc.tenant_id, p_forma_pagamento);
      END LOOP;
    END IF;
  ELSE
    -- recorrente: EF one-shot + qtd_parcelas × fee_recorrente mensal
    IF COALESCE(v_op.valor_ef,0) > 0 THEN
      INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total, tenant_id, forma_pagamento)
      VALUES (p_account_id, v_op.id, v_op.valor_ef, CURRENT_DATE, 'ef', 1, 1, v_acc.tenant_id, p_forma_pagamento);
    END IF;
    IF COALESCE(v_op.valor_fee,0) > 0 THEN
      FOR i IN 1..p_qtd_parcelas LOOP
        INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total, tenant_id, forma_pagamento)
        VALUES (p_account_id, v_op.id, v_op.valor_fee,
                (CURRENT_DATE + (i || ' months')::interval)::DATE,
                'fee_recorrente', i, p_qtd_parcelas, v_acc.tenant_id, p_forma_pagamento);
      END LOOP;
    END IF;
  END IF;

  UPDATE public.accounts
  SET faturamento_status = 'faturado',
      forma_pagamento = p_forma_pagamento,
      qtd_parcelas = p_qtd_parcelas,
      modelo_contrato = p_modelo_contrato,
      faturamento_validated_at = now(),
      faturamento_validated_by = auth.uid()
  WHERE id = p_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_faturamento_account(UUID,TEXT,INT,TEXT) TO authenticated;

-- 4) Backfill: manda todas as accounts existentes pra 'a_faturar' e limpa cobranças não pagas
UPDATE public.accounts SET faturamento_status = 'a_faturar'
WHERE faturamento_status IS NULL OR faturamento_status = 'a_faturar' OR faturamento_validated_at IS NULL;

DELETE FROM public.cobrancas WHERE status IN ('pendente','atrasado');
