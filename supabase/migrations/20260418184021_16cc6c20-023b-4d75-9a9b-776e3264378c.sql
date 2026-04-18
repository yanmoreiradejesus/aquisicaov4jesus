-- ============ ENUMS ============
CREATE TYPE public.lead_etapa AS ENUM (
  'entrada', 'tentativa_contato', 'contato_realizado',
  'desqualificado', 'reuniao_agendada', 'reuniao_realizada'
);

CREATE TYPE public.oportunidade_etapa AS ENUM (
  'proposta', 'negociacao', 'fechado', 'follow_up_longo', 'perdido'
);

CREATE TYPE public.account_status AS ENUM ('ativo', 'pausado', 'encerrado');

CREATE TYPE public.cobranca_status AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');

CREATE TYPE public.cobranca_tipo AS ENUM ('fee_setup', 'fee_recorrente', 'ef');

CREATE TYPE public.atividade_tipo AS ENUM ('ligacao', 'email', 'reuniao', 'nota', 'whatsapp');

-- ============ TABELAS ============

-- crm_leads
CREATE TABLE public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  empresa TEXT,
  cargo TEXT,
  origem TEXT,
  tier TEXT,
  urgencia TEXT,
  etapa public.lead_etapa NOT NULL DEFAULT 'entrada',
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_reuniao_agendada TIMESTAMPTZ,
  data_reuniao_realizada TIMESTAMPTZ,
  motivo_desqualificacao TEXT,
  notas TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_leads_etapa ON public.crm_leads(etapa);
CREATE INDEX idx_crm_leads_responsavel ON public.crm_leads(responsavel_id);

-- crm_oportunidades
CREATE TABLE public.crm_oportunidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  nome_oportunidade TEXT NOT NULL,
  etapa public.oportunidade_etapa NOT NULL DEFAULT 'proposta',
  valor_fee NUMERIC(12,2) DEFAULT 0,
  valor_ef NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) GENERATED ALWAYS AS (COALESCE(valor_fee,0) + COALESCE(valor_ef,0)) STORED,
  data_proposta TIMESTAMPTZ,
  data_fechamento_previsto DATE,
  data_fechamento_real TIMESTAMPTZ,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  motivo_perda TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_oport_etapa ON public.crm_oportunidades(etapa);
CREATE INDEX idx_crm_oport_responsavel ON public.crm_oportunidades(responsavel_id);

-- accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oportunidade_id UUID REFERENCES public.crm_oportunidades(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  data_inicio_contrato DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim_contrato DATE,
  status public.account_status NOT NULL DEFAULT 'ativo',
  account_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  health_score INTEGER CHECK (health_score BETWEEN 0 AND 100),
  proxima_revisao DATE,
  produtos_contratados JSONB DEFAULT '{}'::jsonb,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_status ON public.accounts(status);
CREATE INDEX idx_accounts_manager ON public.accounts(account_manager_id);

-- cobrancas
CREATE TABLE public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  oportunidade_id UUID REFERENCES public.crm_oportunidades(id) ON DELETE SET NULL,
  valor NUMERIC(12,2) NOT NULL,
  vencimento DATE NOT NULL,
  status public.cobranca_status NOT NULL DEFAULT 'pendente',
  tipo public.cobranca_tipo NOT NULL,
  parcela_num INTEGER,
  parcela_total INTEGER,
  data_pagamento DATE,
  forma_pagamento TEXT,
  nota_fiscal TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobrancas_account ON public.cobrancas(account_id);
CREATE INDEX idx_cobrancas_status ON public.cobrancas(status);
CREATE INDEX idx_cobrancas_vencimento ON public.cobrancas(vencimento);

-- crm_atividades
CREATE TABLE public.crm_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  oportunidade_id UUID REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  tipo public.atividade_tipo NOT NULL,
  descricao TEXT,
  usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (lead_id IS NOT NULL OR oportunidade_id IS NOT NULL)
);

CREATE INDEX idx_atividades_lead ON public.crm_atividades(lead_id);
CREATE INDEX idx_atividades_oport ON public.crm_atividades(oportunidade_id);

-- ============ TRIGGERS DE TIMESTAMP ============
CREATE TRIGGER update_crm_leads_updated_at BEFORE UPDATE ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_oport_updated_at BEFORE UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cobrancas_updated_at BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTOMAÇÕES ============

-- Lead → Oportunidade
CREATE OR REPLACE FUNCTION public.auto_create_oportunidade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.etapa = 'reuniao_realizada' AND (OLD.etapa IS DISTINCT FROM 'reuniao_realizada') THEN
    IF NOT EXISTS (SELECT 1 FROM public.crm_oportunidades WHERE lead_id = NEW.id) THEN
      INSERT INTO public.crm_oportunidades (lead_id, nome_oportunidade, etapa, responsavel_id, data_proposta)
      VALUES (
        NEW.id,
        COALESCE(NEW.empresa, NEW.nome) || ' - Oportunidade',
        'proposta',
        NEW.responsavel_id,
        now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lead_to_oportunidade
  AFTER UPDATE OF etapa ON public.crm_leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_oportunidade();

-- Oportunidade fechada → Account + Cobranças
CREATE OR REPLACE FUNCTION public.auto_create_account_and_cobrancas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_account_id UUID;
  v_cliente TEXT;
  v_lead RECORD;
  i INTEGER;
BEGIN
  IF NEW.etapa = 'fechado' AND (OLD.etapa IS DISTINCT FROM 'fechado') THEN
    -- evita duplicação
    IF EXISTS (SELECT 1 FROM public.accounts WHERE oportunidade_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    SELECT empresa, nome INTO v_lead FROM public.crm_leads WHERE id = NEW.lead_id;
    v_cliente := COALESCE(v_lead.empresa, v_lead.nome, NEW.nome_oportunidade);

    INSERT INTO public.accounts (oportunidade_id, cliente_nome, account_manager_id, data_inicio_contrato)
    VALUES (NEW.id, v_cliente, NEW.responsavel_id, COALESCE(NEW.data_fechamento_real::DATE, CURRENT_DATE))
    RETURNING id INTO v_account_id;

    -- 1x EF no fechamento
    IF COALESCE(NEW.valor_ef, 0) > 0 THEN
      INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total)
      VALUES (v_account_id, NEW.id, NEW.valor_ef, CURRENT_DATE, 'ef', 1, 1);
    END IF;

    -- 12x fee mensal a partir do mês seguinte
    IF COALESCE(NEW.valor_fee, 0) > 0 THEN
      FOR i IN 1..12 LOOP
        INSERT INTO public.cobrancas (account_id, oportunidade_id, valor, vencimento, tipo, parcela_num, parcela_total)
        VALUES (v_account_id, NEW.id, NEW.valor_fee, (CURRENT_DATE + (i || ' months')::interval)::DATE, 'fee_recorrente', i, 12);
      END LOOP;
    END IF;

    -- atualiza data_fechamento_real se não estava setado
    IF NEW.data_fechamento_real IS NULL THEN
      UPDATE public.crm_oportunidades SET data_fechamento_real = now() WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_oportunidade_to_account
  AFTER UPDATE OF etapa ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_account_and_cobrancas();

-- Marca cobranças vencidas (chamada por cron futuramente)
CREATE OR REPLACE FUNCTION public.marcar_cobrancas_atrasadas()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.cobrancas
  SET status = 'atrasado'
  WHERE status = 'pendente' AND vencimento < CURRENT_DATE;
END;
$$;

-- ============ RLS ============
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_atividades ENABLE ROW LEVEL SECURITY;

-- crm_leads
CREATE POLICY "Authenticated read leads" ON public.crm_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert leads" ON public.crm_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owner or admin update leads" ON public.crm_leads FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR responsavel_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Admin delete leads" ON public.crm_leads FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- crm_oportunidades
CREATE POLICY "Authenticated read oport" ON public.crm_oportunidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert oport" ON public.crm_oportunidades FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owner or admin update oport" ON public.crm_oportunidades FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR responsavel_id = auth.uid());
CREATE POLICY "Admin delete oport" ON public.crm_oportunidades FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- accounts
CREATE POLICY "Authenticated read accounts" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert accounts" ON public.accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Manager or admin update accounts" ON public.accounts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR account_manager_id = auth.uid());
CREATE POLICY "Admin delete accounts" ON public.accounts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- cobrancas
CREATE POLICY "Authenticated read cobrancas" ON public.cobrancas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert cobrancas" ON public.cobrancas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update cobrancas" ON public.cobrancas FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete cobrancas" ON public.cobrancas FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- crm_atividades
CREATE POLICY "Authenticated read atividades" ON public.crm_atividades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert atividades" ON public.crm_atividades FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Author or admin delete atividades" ON public.crm_atividades FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR usuario_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_oportunidades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cobrancas;