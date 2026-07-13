
-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE public.tarefa_status AS ENUM ('a_fazer','em_execucao','bloqueada','concluida','cancelada');
CREATE TYPE public.tarefa_prioridade AS ENUM ('baixa','media','alta','urgente');
CREATE TYPE public.tarefa_escopo AS ENUM ('trafego','social_media','design','crm');
CREATE TYPE public.tarefa_etapa_status AS ENUM ('pendente','em_execucao','concluida','pulada');

-- ============================================================================
-- TAREFAS
-- ============================================================================
CREATE TABLE public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  projeto_id UUID REFERENCES public.crm_projetos(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  escopo public.tarefa_escopo,
  prioridade public.tarefa_prioridade NOT NULL DEFAULT 'media',
  status public.tarefa_status NOT NULL DEFAULT 'a_fazer',
  prazo_final TIMESTAMPTZ,
  etapa_atual_id UUID,
  criado_por UUID,
  concluida_em TIMESTAMPTZ,
  cancelada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefas_tenant ON public.tarefas(tenant_id);
CREATE INDEX idx_tarefas_projeto ON public.tarefas(projeto_id);
CREATE INDEX idx_tarefas_account ON public.tarefas(account_id);
CREATE INDEX idx_tarefas_status ON public.tarefas(status);
CREATE INDEX idx_tarefas_etapa_atual ON public.tarefas(etapa_atual_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tarefas visíveis para o tenant" ON public.tarefas
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tarefas insert no tenant" ON public.tarefas
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Tarefas update no tenant" ON public.tarefas
  FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tarefas delete no tenant" ON public.tarefas
  FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE TRIGGER tarefas_set_tenant BEFORE INSERT ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();
CREATE TRIGGER tarefas_updated_at BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- TAREFA_ETAPAS
-- ============================================================================
CREATE TABLE public.tarefa_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  nome TEXT NOT NULL,
  funcao TEXT,
  responsavel_id UUID,
  prazo TIMESTAMPTZ,
  status public.tarefa_etapa_status NOT NULL DEFAULT 'pendente',
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  concluida_por UUID,
  observacao_conclusao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefa_etapas_tarefa ON public.tarefa_etapas(tarefa_id, ordem);
CREATE INDEX idx_tarefa_etapas_responsavel ON public.tarefa_etapas(responsavel_id);
CREATE INDEX idx_tarefa_etapas_tenant ON public.tarefa_etapas(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_etapas TO authenticated;
GRANT ALL ON public.tarefa_etapas TO service_role;
ALTER TABLE public.tarefa_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Etapas visíveis no tenant" ON public.tarefa_etapas
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Etapas insert no tenant" ON public.tarefa_etapas
  FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Etapas update no tenant" ON public.tarefa_etapas
  FOR UPDATE TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Etapas delete no tenant" ON public.tarefa_etapas
  FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE TRIGGER tarefa_etapas_set_tenant BEFORE INSERT ON public.tarefa_etapas
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();
CREATE TRIGGER tarefa_etapas_updated_at BEFORE UPDATE ON public.tarefa_etapas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tarefas
  ADD CONSTRAINT tarefas_etapa_atual_fk FOREIGN KEY (etapa_atual_id)
  REFERENCES public.tarefa_etapas(id) ON DELETE SET NULL;

-- ============================================================================
-- CHECKLIST / COMENTARIOS / ANEXOS / ATIVIDADES
-- ============================================================================
CREATE TABLE public.tarefa_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  concluido BOOLEAN NOT NULL DEFAULT false,
  concluido_em TIMESTAMPTZ,
  concluido_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefa_checklist_tarefa ON public.tarefa_checklist_items(tarefa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_checklist_items TO authenticated;
GRANT ALL ON public.tarefa_checklist_items TO service_role;
ALTER TABLE public.tarefa_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Checklist tenant" ON public.tarefa_checklist_items
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE TRIGGER tarefa_checklist_set_tenant BEFORE INSERT ON public.tarefa_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TABLE public.tarefa_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  autor_id UUID,
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefa_comentarios_tarefa ON public.tarefa_comentarios(tarefa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_comentarios TO authenticated;
GRANT ALL ON public.tarefa_comentarios TO service_role;
ALTER TABLE public.tarefa_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comentarios tenant" ON public.tarefa_comentarios
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE TRIGGER tarefa_comentarios_set_tenant BEFORE INSERT ON public.tarefa_comentarios
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TABLE public.tarefa_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  mime TEXT,
  tamanho BIGINT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefa_anexos_tarefa ON public.tarefa_anexos(tarefa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_anexos TO authenticated;
GRANT ALL ON public.tarefa_anexos TO service_role;
ALTER TABLE public.tarefa_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anexos tenant" ON public.tarefa_anexos
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE TRIGGER tarefa_anexos_set_tenant BEFORE INSERT ON public.tarefa_anexos
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TABLE public.tarefa_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  tarefa_id UUID NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT,
  usuario_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefa_atividades_tarefa ON public.tarefa_atividades(tarefa_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_atividades TO authenticated;
GRANT ALL ON public.tarefa_atividades TO service_role;
ALTER TABLE public.tarefa_atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Atividades tenant" ON public.tarefa_atividades
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE TRIGGER tarefa_atividades_set_tenant BEFORE INSERT ON public.tarefa_atividades
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- ============================================================================
-- TEMPLATES DE FLUXO
-- ============================================================================
CREATE TABLE public.tarefa_fluxo_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  squad TEXT,
  nome TEXT NOT NULL,
  descricao TEXT,
  escopo public.tarefa_escopo,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefa_fluxo_templates_tenant ON public.tarefa_fluxo_templates(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_fluxo_templates TO authenticated;
GRANT ALL ON public.tarefa_fluxo_templates TO service_role;
ALTER TABLE public.tarefa_fluxo_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fluxo tpl tenant" ON public.tarefa_fluxo_templates
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE TRIGGER tarefa_fluxo_tpl_set_tenant BEFORE INSERT ON public.tarefa_fluxo_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();
CREATE TRIGGER tarefa_fluxo_tpl_updated_at BEFORE UPDATE ON public.tarefa_fluxo_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tarefa_fluxo_template_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES public.tarefa_fluxo_templates(id) ON DELETE CASCADE,
  ordem INT NOT NULL,
  nome TEXT NOT NULL,
  funcao_sugerida TEXT,
  responsavel_padrao_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefa_fluxo_tpl_etapas_template ON public.tarefa_fluxo_template_etapas(template_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefa_fluxo_template_etapas TO authenticated;
GRANT ALL ON public.tarefa_fluxo_template_etapas TO service_role;
ALTER TABLE public.tarefa_fluxo_template_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fluxo tpl etapas tenant" ON public.tarefa_fluxo_template_etapas
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());
CREATE TRIGGER tarefa_fluxo_tpl_etapas_set_tenant BEFORE INSERT ON public.tarefa_fluxo_template_etapas
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

-- ============================================================================
-- LÓGICA DE FLUXO: avança etapa e loga atividade
-- ============================================================================
CREATE OR REPLACE FUNCTION public.tarefa_log(_tarefa_id UUID, _tipo TEXT, _descricao TEXT, _metadata JSONB DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.tarefas WHERE id = _tarefa_id;
  IF v_tenant IS NULL THEN RETURN; END IF;
  INSERT INTO public.tarefa_atividades (tarefa_id, tenant_id, tipo, descricao, usuario_id, metadata)
  VALUES (_tarefa_id, v_tenant, _tipo, _descricao, auth.uid(), _metadata);
END;
$$;

CREATE OR REPLACE FUNCTION public.tarefa_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.tarefa_log(NEW.id, 'criacao', 'Tarefa criada', NULL);
  RETURN NEW;
END;
$$;
CREATE TRIGGER tarefa_log_insert AFTER INSERT ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tarefa_after_insert();

CREATE OR REPLACE FUNCTION public.tarefa_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'concluida' AND NEW.concluida_em IS NULL THEN
      NEW.concluida_em := now();
    END IF;
    IF NEW.status = 'cancelada' AND NEW.cancelada_em IS NULL THEN
      NEW.cancelada_em := now();
    END IF;
    PERFORM public.tarefa_log(
      NEW.id,
      'mudanca_status',
      'Status: ' || OLD.status::text || ' → ' || NEW.status::text,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tarefa_status_change_trg BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.tarefa_status_change();

-- Avança para próxima etapa quando a atual conclui/pula.
CREATE OR REPLACE FUNCTION public.tarefa_etapa_advance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next public.tarefa_etapas%ROWTYPE;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status IN ('concluida','pulada') THEN

    IF NEW.status = 'concluida' AND NEW.concluida_em IS NULL THEN
      NEW.concluida_em := now();
      NEW.concluida_por := auth.uid();
    END IF;

    PERFORM public.tarefa_log(
      NEW.tarefa_id,
      CASE WHEN NEW.status = 'concluida' THEN 'etapa_concluida' ELSE 'etapa_pulada' END,
      'Etapa "' || NEW.nome || '" ' || CASE WHEN NEW.status='concluida' THEN 'concluída' ELSE 'pulada' END,
      jsonb_build_object('etapa_id', NEW.id, 'ordem', NEW.ordem)
    );

    -- Próxima etapa pendente
    SELECT * INTO v_next
    FROM public.tarefa_etapas
    WHERE tarefa_id = NEW.tarefa_id
      AND ordem > NEW.ordem
      AND status = 'pendente'
    ORDER BY ordem ASC
    LIMIT 1;

    IF v_next.id IS NOT NULL THEN
      UPDATE public.tarefa_etapas
      SET status = 'em_execucao', iniciada_em = now()
      WHERE id = v_next.id;
      UPDATE public.tarefas
      SET etapa_atual_id = v_next.id, status = 'em_execucao'
      WHERE id = NEW.tarefa_id;
    ELSE
      -- Não há próxima → conclui tarefa
      UPDATE public.tarefas
      SET etapa_atual_id = NULL, status = 'concluida', concluida_em = COALESCE(concluida_em, now())
      WHERE id = NEW.tarefa_id;
    END IF;
  ELSIF NEW.status = 'em_execucao' AND OLD.status = 'pendente' THEN
    IF NEW.iniciada_em IS NULL THEN NEW.iniciada_em := now(); END IF;
    UPDATE public.tarefas SET etapa_atual_id = NEW.id, status = 'em_execucao' WHERE id = NEW.tarefa_id;
  END IF;

  RETURN NEW;
END;
$$;
CREATE TRIGGER tarefa_etapa_advance_trg BEFORE UPDATE ON public.tarefa_etapas
  FOR EACH ROW EXECUTE FUNCTION public.tarefa_etapa_advance();

-- ============================================================================
-- LIMPEZA eKYTE
-- ============================================================================
ALTER TABLE public.accounts DROP COLUMN IF EXISTS ekyte_workspace_id;

-- ============================================================================
-- HABILITAR PÁGINA PARA O TENANT PILOTO (V4 Jesus)
-- ============================================================================
INSERT INTO public.tenant_enabled_pages (tenant_id, page_path)
SELECT id, '/peg/tarefas' FROM public.tenants WHERE client_slug = 'jesus'
ON CONFLICT DO NOTHING;
INSERT INTO public.tenant_enabled_pages (tenant_id, page_path)
SELECT id, '/peg/tarefas/squad' FROM public.tenants WHERE client_slug = 'jesus'
ON CONFLICT DO NOTHING;
