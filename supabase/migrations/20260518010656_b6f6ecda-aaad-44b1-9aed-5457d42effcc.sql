
-- 1) Trigger function: preenche tenant_id a partir do usuário logado
CREATE OR REPLACE FUNCTION public.set_tenant_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.profiles WHERE id = auth.uid();
    IF v_tenant IS NOT NULL THEN
      NEW.tenant_id := v_tenant;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Anexa em todas as tabelas de domínio
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'crm_leads','crm_oportunidades','crm_atividades','crm_call_events',
    'crm_copilot_attachments','accounts','cobrancas','voip_accounts',
    'mix_goals','monthly_goals','role_access_templates','user_page_access',
    'user_roles','user_google_tokens'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_tenant_id_on_insert ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER set_tenant_id_on_insert BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert()', t
    );
  END LOOP;
END$$;

-- 3) Atualiza triggers que inserem em cadeia para copiar tenant_id da linha de origem
CREATE OR REPLACE FUNCTION public.log_lead_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_atividades (lead_id, tipo, descricao, usuario_id, tenant_id)
  VALUES (NEW.id, 'criacao', 'Lead cadastrado no sistema', NEW.created_by, NEW.tenant_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_create_oportunidade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.etapa = 'reuniao_realizada' AND (OLD.etapa IS DISTINCT FROM 'reuniao_realizada') THEN
    IF NOT EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE lead_id = NEW.id) THEN
      INSERT INTO public.crm_oportunidades (lead_id, nome_oportunidade, etapa, responsavel_id, data_proposta, tenant_id)
      VALUES (
        NEW.id,
        COALESCE(NEW.empresa, NEW.nome),
        'proposta',
        NEW.responsavel_id,
        now(),
        NEW.tenant_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_create_account_and_cobrancas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    VALUES (NEW.id, v_cliente, NEW.responsavel_id, COALESCE(NEW.data_fechamento_real::DATE, CURRENT_DATE), NEW.tenant_id)
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
$$;

-- 4) handle_new_user respeita tenant_id no metadata (do convite)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
  v_tenant UUID;
BEGIN
  -- Prioriza tenant_id enviado no convite, senão usa V4 Jesus como fallback
  BEGIN
    v_tenant := NULLIF(NEW.raw_user_meta_data->>'tenant_id','')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_tenant := NULL;
  END;

  IF v_tenant IS NULL THEN
    SELECT id INTO v_tenant FROM public.tenants WHERE client_slug = 'jesus' LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, approved, tenant_id)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', FALSE, v_tenant);

  SELECT COUNT(*) = 1 INTO is_first_user FROM public.profiles;

  IF is_first_user THEN
    UPDATE public.profiles SET approved = TRUE WHERE id = NEW.id;
    INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (NEW.id, 'admin', v_tenant);
    INSERT INTO public.user_page_access (user_id, page_path, tenant_id) VALUES
      (NEW.id, '/aquisicao/funil', v_tenant),
      (NEW.id, '/aquisicao/dashboard', v_tenant),
      (NEW.id, '/aquisicao/insights', v_tenant),
      (NEW.id, '/aquisicao/financeiro', v_tenant),
      (NEW.id, '/aquisicao/legado/funil', v_tenant),
      (NEW.id, '/aquisicao/legado/meta', v_tenant);
  END IF;

  RETURN NEW;
END;
$$;
