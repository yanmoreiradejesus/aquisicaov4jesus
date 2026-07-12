
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS dia_vencimento_primeiro_ef INT,
  ADD COLUMN IF NOT EXISTS dia_vencimento_demais_ef INT,
  ADD COLUMN IF NOT EXISTS dia_vencimento_primeiro_recorrente INT,
  ADD COLUMN IF NOT EXISTS dia_vencimento_demais_recorrente INT;

CREATE OR REPLACE FUNCTION public.validar_faturamento_account_v2(
  p_account_id uuid,
  p_modelo_contrato text,
  p_forma_ef text,
  p_qtd_parcelas_ef integer,
  p_valor_ef numeric,
  p_forma_recorrente text,
  p_qtd_parcelas_recorrente integer,
  p_valor_fee numeric,
  p_dia_venc_primeiro_ef integer DEFAULT NULL,
  p_dia_venc_demais_ef integer DEFAULT NULL,
  p_dia_venc_primeiro_rec integer DEFAULT NULL,
  p_dia_venc_demais_rec integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acc RECORD;
  v_op RECORD;
  v_parc NUMERIC;
  i INT;
  v_tem_ef BOOLEAN;
  v_tem_rec BOOLEAN;
  v_venc DATE;
  v_base_month DATE;
  v_dia INT;
  v_last_day INT;
BEGIN
  IF p_modelo_contrato NOT IN ('escopo_fechado','recorrente','hibrido') THEN
    RAISE EXCEPTION 'Modelo de contrato inválido';
  END IF;

  v_tem_ef  := p_modelo_contrato IN ('escopo_fechado','hibrido');
  v_tem_rec := p_modelo_contrato IN ('recorrente','hibrido');

  IF v_tem_ef  AND (p_forma_ef IS NULL OR p_qtd_parcelas_ef IS NULL OR p_qtd_parcelas_ef < 1) THEN
    RAISE EXCEPTION 'Forma/parcelas do escopo fechado inválidas';
  END IF;
  IF v_tem_rec AND (p_forma_recorrente IS NULL OR p_qtd_parcelas_recorrente IS NULL OR p_qtd_parcelas_recorrente < 1) THEN
    RAISE EXCEPTION 'Forma/meses da recorrência inválidos';
  END IF;

  SELECT * INTO v_acc FROM public.accounts WHERE id = p_account_id;
  IF v_acc.id IS NULL THEN RAISE EXCEPTION 'Account não encontrada'; END IF;
  SELECT * INTO v_op FROM public.crm_oportunidades WHERE id = v_acc.oportunidade_id;

  DELETE FROM public.cobrancas
   WHERE account_id = p_account_id AND status IN ('pendente','atrasado');

  -- ESCOPO FECHADO
  IF v_tem_ef AND COALESCE(p_valor_ef,0) > 0 THEN
    v_parc := ROUND(p_valor_ef / p_qtd_parcelas_ef, 2);
    FOR i IN 1..p_qtd_parcelas_ef LOOP
      v_base_month := (date_trunc('month', CURRENT_DATE) + ((i-1) || ' months')::interval)::DATE;
      v_dia := CASE
        WHEN i = 1 THEN COALESCE(p_dia_venc_primeiro_ef, EXTRACT(DAY FROM CURRENT_DATE)::INT)
        ELSE COALESCE(p_dia_venc_demais_ef, p_dia_venc_primeiro_ef, EXTRACT(DAY FROM CURRENT_DATE)::INT)
      END;
      v_last_day := EXTRACT(DAY FROM (v_base_month + interval '1 month - 1 day'))::INT;
      IF v_dia > v_last_day THEN v_dia := v_last_day; END IF;
      IF v_dia < 1 THEN v_dia := 1; END IF;
      v_venc := (v_base_month + ((v_dia - 1) || ' days')::interval)::DATE;

      INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total, tenant_id, forma_pagamento)
      VALUES (p_account_id, v_op.id, v_parc, v_venc, 'ef', i, p_qtd_parcelas_ef, v_acc.tenant_id, p_forma_ef);
    END LOOP;
  END IF;

  -- RECORRENTE
  IF v_tem_rec AND COALESCE(p_valor_fee,0) > 0 THEN
    FOR i IN 1..p_qtd_parcelas_recorrente LOOP
      v_base_month := (date_trunc('month', CURRENT_DATE) + (i || ' months')::interval)::DATE;
      v_dia := CASE
        WHEN i = 1 THEN COALESCE(p_dia_venc_primeiro_rec, EXTRACT(DAY FROM CURRENT_DATE)::INT)
        ELSE COALESCE(p_dia_venc_demais_rec, p_dia_venc_primeiro_rec, EXTRACT(DAY FROM CURRENT_DATE)::INT)
      END;
      v_last_day := EXTRACT(DAY FROM (v_base_month + interval '1 month - 1 day'))::INT;
      IF v_dia > v_last_day THEN v_dia := v_last_day; END IF;
      IF v_dia < 1 THEN v_dia := 1; END IF;
      v_venc := (v_base_month + ((v_dia - 1) || ' days')::interval)::DATE;

      INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total, tenant_id, forma_pagamento)
      VALUES (p_account_id, v_op.id, p_valor_fee, v_venc, 'fee_recorrente', i, p_qtd_parcelas_recorrente, v_acc.tenant_id, p_forma_recorrente);
    END LOOP;
  END IF;

  UPDATE public.accounts
     SET faturamento_status = 'faturado',
         modelo_contrato = p_modelo_contrato,
         forma_pagamento_ef = CASE WHEN v_tem_ef THEN p_forma_ef ELSE NULL END,
         qtd_parcelas_ef    = CASE WHEN v_tem_ef THEN p_qtd_parcelas_ef ELSE NULL END,
         valor_ef_override  = CASE WHEN v_tem_ef THEN p_valor_ef ELSE NULL END,
         dia_vencimento_primeiro_ef = CASE WHEN v_tem_ef THEN p_dia_venc_primeiro_ef ELSE NULL END,
         dia_vencimento_demais_ef   = CASE WHEN v_tem_ef THEN p_dia_venc_demais_ef ELSE NULL END,
         forma_pagamento_recorrente = CASE WHEN v_tem_rec THEN p_forma_recorrente ELSE NULL END,
         qtd_parcelas_recorrente    = CASE WHEN v_tem_rec THEN p_qtd_parcelas_recorrente ELSE NULL END,
         valor_fee_override         = CASE WHEN v_tem_rec THEN p_valor_fee ELSE NULL END,
         dia_vencimento_primeiro_recorrente = CASE WHEN v_tem_rec THEN p_dia_venc_primeiro_rec ELSE NULL END,
         dia_vencimento_demais_recorrente   = CASE WHEN v_tem_rec THEN p_dia_venc_demais_rec ELSE NULL END,
         forma_pagamento = COALESCE(
           CASE WHEN v_tem_rec THEN p_forma_recorrente END,
           CASE WHEN v_tem_ef  THEN p_forma_ef END
         ),
         qtd_parcelas = COALESCE(
           CASE WHEN v_tem_rec THEN p_qtd_parcelas_recorrente END,
           CASE WHEN v_tem_ef  THEN p_qtd_parcelas_ef END
         ),
         faturamento_validated_at = now(),
         faturamento_validated_by = auth.uid()
   WHERE id = p_account_id;
END;
$function$;
