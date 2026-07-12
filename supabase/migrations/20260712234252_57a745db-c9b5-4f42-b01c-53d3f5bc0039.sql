
DROP TABLE IF EXISTS public.ekyte_time_trackings CASCADE;
DROP TABLE IF EXISTS public.ekyte_phase_performance CASCADE;
DROP TABLE IF EXISTS public.ekyte_tasks CASCADE;
DROP TABLE IF EXISTS public.ekyte_projects CASCADE;
DROP TABLE IF EXISTS public.ekyte_workspaces CASCADE;
DROP TABLE IF EXISTS public.ekyte_sync_log CASCADE;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('backlog','em_execucao','revisao','aprovado','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_prioridade AS ENUM ('baixa','media','alta','urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.task_fases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  projeto_id UUID REFERENCES public.crm_projetos(id) ON DELETE CASCADE,
  squad TEXT,
  nome TEXT NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  cor TEXT,
  wip_limit INT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_fases TO authenticated;
GRANT ALL ON public.task_fases TO service_role;
ALTER TABLE public.task_fases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read task_fases" ON public.task_fases FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant write task_fases" ON public.task_fases FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE INDEX idx_task_fases_projeto ON public.task_fases(projeto_id, ordem);
CREATE INDEX idx_task_fases_tenant ON public.task_fases(tenant_id);
CREATE TRIGGER trg_task_fases_updated_at BEFORE UPDATE ON public.task_fases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_task_fases_tenant BEFORE INSERT ON public.task_fases FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  projeto_id UUID REFERENCES public.crm_projetos(id) ON DELETE CASCADE,
  squad TEXT,
  fase_id UUID REFERENCES public.task_fases(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  prioridade public.task_prioridade NOT NULL DEFAULT 'media',
  status public.task_status NOT NULL DEFAULT 'backlog',
  prazo DATE,
  iniciado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  estimativa_horas NUMERIC(6,2),
  horas_gastas NUMERIC(6,2) NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read tasks" ON public.tasks FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant write tasks" ON public.tasks FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE INDEX idx_tasks_projeto_status ON public.tasks(projeto_id, status);
CREATE INDEX idx_tasks_resp_status ON public.tasks(responsavel_id, status);
CREATE INDEX idx_tasks_tenant_prazo ON public.tasks(tenant_id, prazo);
CREATE INDEX idx_tasks_fase_ordem ON public.tasks(fase_id, ordem);
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_tasks_tenant BEFORE INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TABLE public.task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  concluido BOOLEAN NOT NULL DEFAULT false,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_checklist_items TO authenticated;
GRANT ALL ON public.task_checklist_items TO service_role;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read checklist" ON public.task_checklist_items FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant write checklist" ON public.task_checklist_items FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE INDEX idx_checklist_task ON public.task_checklist_items(task_id, ordem);
CREATE TRIGGER trg_checklist_updated_at BEFORE UPDATE ON public.task_checklist_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_checklist_tenant BEFORE INSERT ON public.task_checklist_items FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TABLE public.task_comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  autor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  conteudo TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comentarios TO authenticated;
GRANT ALL ON public.task_comentarios TO service_role;
ALTER TABLE public.task_comentarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read comentarios" ON public.task_comentarios FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant write comentarios" ON public.task_comentarios FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE INDEX idx_comentarios_task ON public.task_comentarios(task_id, created_at);
CREATE TRIGGER trg_comentarios_updated_at BEFORE UPDATE ON public.task_comentarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comentarios_tenant BEFORE INSERT ON public.task_comentarios FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TABLE public.task_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  mime TEXT,
  tamanho_bytes BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_anexos TO authenticated;
GRANT ALL ON public.task_anexos TO service_role;
ALTER TABLE public.task_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read anexos" ON public.task_anexos FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant write anexos" ON public.task_anexos FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE INDEX idx_anexos_task ON public.task_anexos(task_id);
CREATE TRIGGER trg_anexos_tenant BEFORE INSERT ON public.task_anexos FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_on_insert();

CREATE TABLE public.task_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  descricao TEXT,
  usuario_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_atividades TO authenticated;
GRANT ALL ON public.task_atividades TO service_role;
ALTER TABLE public.task_atividades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant read task_atividades" ON public.task_atividades FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tenant write task_atividades" ON public.task_atividades FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE INDEX idx_task_atividades_task ON public.task_atividades(task_id, created_at);

CREATE OR REPLACE FUNCTION public.log_task_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_atividades (task_id, tenant_id, tipo, descricao, usuario_id)
    VALUES (NEW.id, NEW.tenant_id, 'criacao', 'Tarefa criada', auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'em_execucao' AND NEW.iniciado_em IS NULL THEN NEW.iniciado_em := now(); END IF;
    IF NEW.status = 'concluido' AND NEW.concluido_em IS NULL THEN NEW.concluido_em := now(); END IF;
    INSERT INTO public.task_atividades (task_id, tenant_id, tipo, descricao, usuario_id)
    VALUES (NEW.id, NEW.tenant_id, 'mudanca_status',
            'Status alterado de "' || OLD.status::text || '" para "' || NEW.status::text || '"',
            auth.uid());
  END IF;

  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO public.task_atividades (task_id, tenant_id, tipo, descricao, usuario_id)
    VALUES (NEW.id, NEW.tenant_id, 'mudanca_responsavel', 'Responsável alterado', auth.uid());
  END IF;

  IF NEW.prazo IS DISTINCT FROM OLD.prazo THEN
    INSERT INTO public.task_atividades (task_id, tenant_id, tipo, descricao, usuario_id)
    VALUES (NEW.id, NEW.tenant_id, 'mudanca_prazo',
            'Prazo alterado para ' || COALESCE(NEW.prazo::text, '—'), auth.uid());
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_tasks_log
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_changes();
