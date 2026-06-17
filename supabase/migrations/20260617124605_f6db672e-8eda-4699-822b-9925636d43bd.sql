
-- Helper macro: we repeat the same shape for each mirror table.

-- 1. ekyte_workspaces
CREATE TABLE public.ekyte_workspaces (
  id_local uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ekyte_id bigint NOT NULL,
  name text,
  squad_name text,
  active boolean,
  external_id text,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ekyte_id)
);
GRANT SELECT ON public.ekyte_workspaces TO authenticated;
GRANT ALL ON public.ekyte_workspaces TO service_role;
ALTER TABLE public.ekyte_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ekyte_workspaces select tenant" ON public.ekyte_workspaces
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ekyte_workspaces service write" ON public.ekyte_workspaces
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ekyte_workspaces_updated BEFORE UPDATE ON public.ekyte_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. ekyte_projects
CREATE TABLE public.ekyte_projects (
  id_local uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ekyte_id bigint NOT NULL,
  name text,
  workspace_ekyte_id bigint,
  situation int,
  planned_tasks_count int,
  accomplished_tasks_count int,
  planned_tasks_time int,
  accomplished_tasks_time int,
  start_date timestamptz,
  end_date timestamptz,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ekyte_id)
);
CREATE INDEX idx_ekyte_projects_workspace ON public.ekyte_projects(tenant_id, workspace_ekyte_id);
GRANT SELECT ON public.ekyte_projects TO authenticated;
GRANT ALL ON public.ekyte_projects TO service_role;
ALTER TABLE public.ekyte_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ekyte_projects select tenant" ON public.ekyte_projects
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ekyte_projects service write" ON public.ekyte_projects
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ekyte_projects_updated BEFORE UPDATE ON public.ekyte_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. ekyte_tasks
CREATE TABLE public.ekyte_tasks (
  id_local uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ekyte_id bigint NOT NULL,
  title text,
  workspace_ekyte_id bigint,
  situation int,
  phase text,
  phase_id int,
  executor text,
  executor_id text,
  task_type text,
  ctc_task_type_id int,
  estimated_time int,
  actual_time int,
  current_due_date timestamptz,
  resolved_date timestamptz,
  creation_date timestamptz,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ekyte_id)
);
CREATE INDEX idx_ekyte_tasks_workspace ON public.ekyte_tasks(tenant_id, workspace_ekyte_id);
CREATE INDEX idx_ekyte_tasks_type ON public.ekyte_tasks(tenant_id, ctc_task_type_id);
GRANT SELECT ON public.ekyte_tasks TO authenticated;
GRANT ALL ON public.ekyte_tasks TO service_role;
ALTER TABLE public.ekyte_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ekyte_tasks select tenant" ON public.ekyte_tasks
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ekyte_tasks service write" ON public.ekyte_tasks
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ekyte_tasks_updated BEFORE UPDATE ON public.ekyte_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. ekyte_time_trackings
CREATE TABLE public.ekyte_time_trackings (
  id_local uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ekyte_id bigint NOT NULL,
  workspace_ekyte_id bigint,
  effort int,
  status int,
  executor text,
  executor_id text,
  ctc_task_id bigint,
  ctc_task_type text,
  phase text,
  accomplished_hourly_rate numeric,
  start_date timestamptz,
  end_date timestamptz,
  created_in timestamptz,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ekyte_id)
);
CREATE INDEX idx_ekyte_tt_workspace ON public.ekyte_time_trackings(tenant_id, workspace_ekyte_id);
CREATE INDEX idx_ekyte_tt_executor ON public.ekyte_time_trackings(tenant_id, executor_id);
GRANT SELECT ON public.ekyte_time_trackings TO authenticated;
GRANT ALL ON public.ekyte_time_trackings TO service_role;
ALTER TABLE public.ekyte_time_trackings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ekyte_tt select tenant" ON public.ekyte_time_trackings
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ekyte_tt service write" ON public.ekyte_time_trackings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ekyte_tt_updated BEFORE UPDATE ON public.ekyte_time_trackings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. ekyte_phase_performance
CREATE TABLE public.ekyte_phase_performance (
  id_local uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ekyte_id bigint NOT NULL,
  task_ekyte_id bigint,
  task_title text,
  workspace_ekyte_id bigint,
  executor text,
  executor_email text,
  phase text,
  flow text,
  expected_phase_due_date timestamptz,
  real_phase_due_date timestamptz,
  overdue boolean,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ekyte_id)
);
CREATE INDEX idx_ekyte_pp_workspace ON public.ekyte_phase_performance(tenant_id, workspace_ekyte_id);
CREATE INDEX idx_ekyte_pp_overdue ON public.ekyte_phase_performance(tenant_id, overdue);
GRANT SELECT ON public.ekyte_phase_performance TO authenticated;
GRANT ALL ON public.ekyte_phase_performance TO service_role;
ALTER TABLE public.ekyte_phase_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ekyte_pp select tenant" ON public.ekyte_phase_performance
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ekyte_pp service write" ON public.ekyte_phase_performance
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER trg_ekyte_pp_updated BEFORE UPDATE ON public.ekyte_phase_performance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. ekyte_sync_log (controle do polling)
CREATE TABLE public.ekyte_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text,
  records_synced int,
  error_message text,
  last_cursor text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ekyte_sync_log_tenant_endpoint ON public.ekyte_sync_log(tenant_id, endpoint, started_at DESC);
GRANT SELECT ON public.ekyte_sync_log TO authenticated;
GRANT ALL ON public.ekyte_sync_log TO service_role;
ALTER TABLE public.ekyte_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ekyte_sync_log select tenant" ON public.ekyte_sync_log
  FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ekyte_sync_log service write" ON public.ekyte_sync_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
